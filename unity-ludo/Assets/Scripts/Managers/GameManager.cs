using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace LudoKing3D
{
    /// <summary>
    /// The central orchestrator that ties the game logic with the Unity scene elements.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        [SerializeField] private BoardPathManager board;
        [SerializeField] private DiceController3D dice;
        [SerializeField] private SoundManager sound;
        [SerializeField] private VFXManager vfx;
        [SerializeField] private CameraController cam;

        [SerializeField] private GameObject tokenPrefab;
        [SerializeField] private Material[] playerMaterials;

        private LudoGameState gameState;
        private Dictionary<(PlayerColor, int), TokenController3D> tokenMap = new Dictionary<(PlayerColor, int), TokenController3D>();
        private float turnTimer;
        private bool waitingForAnimation;

        private void OnEnable()
        {
            if (dice != null)
                dice.OnDiceResult += OnDiceRolled;
        }

        private void OnDisable()
        {
            if (dice != null)
                dice.OnDiceResult -= OnDiceRolled;
        }

        private void Update()
        {
            if (gameState == null || waitingForAnimation || gameState.IsGameOver)
                return;

            if (gameState.Phase == GamePhase.WaitingForRoll)
            {
                turnTimer -= Time.deltaTime;
                if (turnTimer <= 0f)
                {
                    LudoEngine.ForfeitTurn(gameState);
                    StartTurn();
                }
            }
        }

        /// <summary>
        /// Creates game state, spawns token GameObjects, and starts the first turn.
        /// </summary>
        public void StartGame(string[] playerNames, bool[] isBot)
        {
            gameState = LudoEngine.CreateGame(playerNames, isBot);
            SpawnTokens();
            StartTurn();
        }

        /// <summary>
        /// Destroys tokens and restarts the game.
        /// </summary>
        public void RestartGame()
        {
            foreach (var kvp in tokenMap)
            {
                if (kvp.Value != null)
                {
                    Destroy(kvp.Value.gameObject);
                }
            }
            tokenMap.Clear();
            
            // Default players for restart
            string[] names = { "Player 1", "Player 2", "Player 3", "Player 4" };
            bool[] bots = { false, true, true, true };
            StartGame(names, bots);
        }

        private void SpawnTokens()
        {
            for (int pIndex = 0; pIndex < gameState.Players.Count; pIndex++)
            {
                PlayerState player = gameState.Players[pIndex];
                Material pMat = playerMaterials[pIndex % playerMaterials.Length];

                for (int tIndex = 0; tIndex < LudoConstants.TOKENS_PER_PLAYER; tIndex++)
                {
                    Vector3 spawnPos = board.GetHomeBasePosition(player.Color, tIndex);
                    GameObject tokenObj = Instantiate(tokenPrefab, spawnPos, Quaternion.identity);
                    TokenController3D token = tokenObj.GetComponent<TokenController3D>();
                    
                    token.Initialize(player.Color, tIndex, pMat);
                    token.OnClicked += OnTokenClicked;
                    
                    tokenMap.Add((player.Color, tIndex), token);
                }
            }
        }

        private void StartTurn()
        {
            waitingForAnimation = false;
            turnTimer = LudoConstants.TURN_TIME_LIMIT;
            ClearTokenHighlights();

            PlayerState activePlayer = gameState.Players[gameState.ActivePlayerIndex];
            
            sound.PlayTurnChime();
            cam.ResetView();

            if (activePlayer.IsBot)
            {
                StartCoroutine(BotTurnCoroutine());
            }
            else
            {
                dice.SetSelectable(true);
            }
        }

        private void OnDiceRolled(int value)
        {
            waitingForAnimation = true;

            if (value == 6)
            {
                sound.PlaySixCelebration();
                vfx.PlaySixBurst(dice.transform.position);
            }

            LudoEngine.RollDice(gameState, value);

            if (gameState.ConsecutiveSixes == 3)
            {
                LudoEngine.AdvanceTurn(gameState);
                StartTurn();
                return;
            }

            if (gameState.Phase == GamePhase.Moving)
            {
                List<int> legalMoves = LudoEngine.GetLegalTokenIndexes(gameState);
                
                if (legalMoves.Count == 0)
                {
                    StartCoroutine(NoMovesDelay());
                }
                else
                {
                    PlayerState activePlayer = gameState.Players[gameState.ActivePlayerIndex];
                    if (activePlayer.IsBot)
                    {
                        int bestMoveIndex = LudoBotAI.ChooseBestMove(gameState, legalMoves);
                        TokenController3D token = tokenMap[(activePlayer.Color, bestMoveIndex)];
                        OnTokenClicked(token);
                    }
                    else
                    {
                        foreach (int idx in legalMoves)
                        {
                            tokenMap[(activePlayer.Color, idx)].SetSelectable(true);
                        }
                        waitingForAnimation = false; // Wait for human click
                    }
                }
            }
        }

        private IEnumerator NoMovesDelay()
        {
            yield return new WaitForSeconds(0.5f);
            LudoEngine.AdvanceTurn(gameState);
            StartTurn();
        }

        private void OnTokenClicked(TokenController3D token)
        {
            if (waitingForAnimation || gameState.Phase != GamePhase.Moving) return;

            ClearTokenHighlights();
            waitingForAnimation = true;
            
            StartCoroutine(ExecuteMoveCoroutine(token));
        }

        private IEnumerator ExecuteMoveCoroutine(TokenController3D token)
        {
            PlayerColor color = token.TokenColor;
            int tokenIndex = token.TokenIndex;
            
            PlayerState player = gameState.Players.FirstOrDefault(p => p.Color == color);
            int startPos = player.Tokens[tokenIndex].Position;

            MoveResult result = LudoEngine.MoveToken(gameState, tokenIndex);
            
            int endPos = player.Tokens[tokenIndex].Position;
            
            Vector3[] waypoints = ComputeWaypoints(color, startPos, endPos);
            
            cam.FocusOn(token.transform.position, 0.5f);
            
            sound.PlayTokenMove();
            yield return token.MoveAlongPath(waypoints);
            
            if (result.CapturedToken != null)
            {
                var capturedToken = result.CapturedToken;
                TokenController3D enemyToken = tokenMap[(capturedToken.Color, capturedToken.Index)];
                
                sound.PlayCapture();
                vfx.PlayCapture(enemyToken.transform.position, GetColorFromEnum(capturedToken.Color));
                cam.ShakeCamera();
                
                Vector3 homePos = board.GetHomeBasePosition(capturedToken.Color, capturedToken.Index);
                yield return enemyToken.ReturnToHome(homePos);
            }
            
            if (result.FinishedToken)
            {
                sound.PlayFinish();
                vfx.PlayFinishToken(token.transform.position, GetColorFromEnum(color));
            }
            
            if (gameState.IsGameOver)
            {
                sound.PlayVictory();
                vfx.PlayVictory(Vector3.zero);
                yield break;
            }

            if (!result.ExtraTurnGranted)
            {
                LudoEngine.AdvanceTurn(gameState);
            }
            
            StartTurn();
        }

        private IEnumerator BotTurnCoroutine()
        {
            yield return new WaitForSeconds(0.7f);
            dice.Roll();
        }

        private void ClearTokenHighlights()
        {
            foreach (var kvp in tokenMap)
            {
                kvp.Value.SetSelectable(false);
            }
        }

        private Vector3[] ComputeWaypoints(PlayerColor color, int fromPos, int toPos)
        {
            List<Vector3> waypoints = new List<Vector3>();
            if (fromPos == LudoConstants.POSITION_BASE)
            {
                waypoints.Add(board.GetWorldPosition(color, LudoConstants.POSITION_START));
                fromPos = LudoConstants.POSITION_START;
            }

            for (int i = fromPos + 1; i <= toPos; i++)
            {
                if (i >= LudoConstants.POSITION_HOME)
                {
                    waypoints.Add(board.GetFinishPosition(color));
                    break;
                }
                waypoints.Add(board.GetWorldPosition(color, i));
            }

            return waypoints.ToArray();
        }

        private Color GetColorFromEnum(PlayerColor color)
        {
            switch (color)
            {
                case PlayerColor.Red: return Color.red;
                case PlayerColor.Green: return Color.green;
                case PlayerColor.Yellow: return Color.yellow;
                case PlayerColor.Blue: return Color.blue;
                default: return Color.white;
            }
        }
    }
}
