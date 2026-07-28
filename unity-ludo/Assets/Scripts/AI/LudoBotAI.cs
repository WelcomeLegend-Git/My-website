using System;
using System.Collections.Generic;

namespace LudoKing3D
{
    /// <summary>
    /// Static class handling AI logic and bot move evaluations for Ludo.
    /// </summary>
    public static class LudoBotAI
    {
        /// <summary>
        /// Evaluates all legal moves for the current state and returns the best token index to move.
        /// Returns -1 if no moves are possible.
        /// </summary>
        public static int ChooseBestMove(LudoGameState state)
        {
            PlayerColor currentColor = state.CurrentPlayerColor;
            int diceValue = state.CurrentDiceValue;
            PlayerState player = state.GetPlayer(currentColor);

            List<int> bestMoves = new List<int>();
            int highestScore = int.MinValue;

            for (int i = 0; i < player.Tokens.Length; i++)
            {
                TokenState token = player.Tokens[i];
                int currentPos = token.Position;

                // Check if the move is legal (assuming generic ludo rules where 57 is max finish line)
                int destination = GetDestination(currentPos, diceValue);
                if (destination == -2) continue; // Illegal move

                int moveScore = EvaluateMove(state, currentColor, currentPos, destination, diceValue);

                if (moveScore > highestScore)
                {
                    highestScore = moveScore;
                    bestMoves.Clear();
                    bestMoves.Add(i);
                }
                else if (moveScore == highestScore)
                {
                    bestMoves.Add(i);
                }
            }

            // On ties, pick randomly
            if (bestMoves.Count > 0)
            {
                Random rng = new Random();
                return bestMoves[rng.Next(bestMoves.Count)];
            }

            return -1;
        }

        /// <summary>
        /// Calculates a score for a specific move based on various heuristic conditions.
        /// </summary>
        private static int EvaluateMove(LudoGameState state, PlayerColor color, int fromPosition, int destination, int diceValue)
        {
            int score = 0;

            // Can capture an opponent (+100)
            if (CanCapture(state, color, fromPosition, diceValue))
            {
                score += 100;
            }

            // Can finish a token (+90)
            if (destination == LudoConstants.FINISH_POSITION)
            {
                score += 90;
            }

            // Can leave home (-1 -> 0) (+70)
            if (fromPosition == LudoConstants.HOME_POSITION && destination == 0)
            {
                score += 70;
            }

            // Moves to a safe square (+30)
            if (LudoUtil.IsSafeSquare(destination))
            {
                score += 30;
            }

            // Advances further on the board (+position / 5)
            if (destination > 0)
            {
                score += (destination / 5);
            }

            // Moves into home lane (position >= 52) (+40)
            if (destination >= LudoConstants.HOME_LANE_START_POSITION && fromPosition < LudoConstants.HOME_LANE_START_POSITION)
            {
                score += 40;
            }

            // Token is currently on an unsafe square with opponents nearby (+20 defensive escape)
            if (fromPosition >= 0 && !LudoUtil.IsSafeSquare(fromPosition))
            {
                int globalPos = LudoUtil.GetGlobalPosition(color, fromPosition);
                if (IsNearOpponent(state, color, globalPos, 6))
                {
                    score += 20;
                }
            }

            // Token would land on opponent blockade (-200)
            int destGlobalPos = LudoUtil.GetGlobalPosition(color, destination);
            if (LudoUtil.IsBlockade(state, destGlobalPos, color))
            {
                score -= 200;
            }

            return score;
        }

        /// <summary>
        /// Checks if moving the token from the given position with the given dice value will capture an opponent.
        /// </summary>
        private static bool CanCapture(LudoGameState state, PlayerColor color, int fromPosition, int diceValue)
        {
            int destination = GetDestination(fromPosition, diceValue);
            if (destination < 0 || LudoUtil.IsSafeSquare(destination)) return false;

            int globalDestPos = LudoUtil.GetGlobalPosition(color, destination);

            // Check if any opponent has a token at this global position
            foreach (PlayerState otherPlayer in state.Players)
            {
                if (otherPlayer.Color == color) continue;

                foreach (TokenState oppToken in otherPlayer.Tokens)
                {
                    if (oppToken.Position >= 0 && oppToken.Position < LudoConstants.HOME_LANE_START_POSITION)
                    {
                        int oppGlobalPos = LudoUtil.GetGlobalPosition(otherPlayer.Color, oppToken.Position);
                        if (oppGlobalPos == globalDestPos)
                        {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Determines the destination relative position based on current position and dice value.
        /// Returns -2 if the move is illegal.
        /// </summary>
        private static int GetDestination(int position, int diceValue)
        {
            // Assuming -1 is home position, and 6 is required to exit.
            if (position == LudoConstants.HOME_POSITION)
            {
                if (diceValue == 6) return 0; // Exiting home
                return -2; // Cannot exit without a 6
            }

            int nextPos = position + diceValue;
            
            // Assume 57 is the center finish point
            if (nextPos > LudoConstants.FINISH_POSITION)
            {
                return -2; // Move overshoots the finish line
            }

            return nextPos;
        }

        /// <summary>
        /// Checks if an opponent token is within a specified radius behind a given global ring index.
        /// </summary>
        private static bool IsNearOpponent(LudoGameState state, PlayerColor color, int ringIndex, int radius = 6)
        {
            foreach (PlayerState otherPlayer in state.Players)
            {
                if (otherPlayer.Color == color) continue;

                foreach (TokenState oppToken in otherPlayer.Tokens)
                {
                    // Ensure opponent token is on the common ring (not in home or home lane)
                    if (oppToken.Position >= 0 && oppToken.Position < LudoConstants.HOME_LANE_START_POSITION)
                    {
                        int oppGlobalPos = LudoUtil.GetGlobalPosition(otherPlayer.Color, oppToken.Position);
                        
                        // Calculate distance behind the current token, wrapping around the 52-cell board
                        int distanceBehind = (ringIndex - oppGlobalPos + LudoConstants.TOTAL_BOARD_SQUARES) % LudoConstants.TOTAL_BOARD_SQUARES;
                        
                        if (distanceBehind > 0 && distanceBehind <= radius)
                        {
                            return true;
                        }
                    }
                }
            }

            return false;
        }
    }
}
