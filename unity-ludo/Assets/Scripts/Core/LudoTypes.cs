// =============================================================================
//  LudoTypes.cs — Core data structures for LudoKing3D
//  Pure C# — no Unity dependencies — safe for unit testing & server reuse.
// =============================================================================

using System;
using System.Collections.Generic;

namespace LudoKing3D
{
    // ─── Enums ──────────────────────────────────────────────────────────

    public enum PlayerColor { Red = 0, Blue = 1, Yellow = 2, Green = 3 }

    public enum GamePhase { WaitingToStart, Rolling, Moving, Finished }

    public enum MoveReason { Normal, LeftHome, Captured, Finished, ExtraTurn }

    public enum TurnEndReason { Moved, NoLegalMove, ThreeSixes, Timeout, Manual }

    // ─── Constants ──────────────────────────────────────────────────────

    public static class LudoConstants
    {
        public const int TOKENS_PER_PLAYER = 4;
        public const int RING_SIZE          = 52;
        public const int HOME_LANE_LENGTH   = 6;   // 5 lane cells + 1 finish slot
        public const int HOME_LANE_START    = 52;   // positions 52‑56 are inside the home lane
        public const int FINISH_POSITION    = 57;
        public const int HOME_POSITION      = -1;
        public const int PLAYER_COUNT_MAX   = 4;

        /// <summary>Ring index where each colour enters the shared ring after leaving home.</summary>
        public static readonly int[] START_RING_INDEX = { 0, 13, 26, 39 };

        /// <summary>Ring index of the safe square just before each colour's home lane.</summary>
        public static readonly int[] ENTRY_RING_INDEX = { 50, 11, 24, 37 };

        /// <summary>Ring indexes that are globally safe (star squares). No captures allowed.</summary>
        public static readonly HashSet<int> SAFE_RING_INDEXES = new HashSet<int>
        {
            0, 8, 13, 21, 26, 34, 39, 47
        };
    }

    // ─── Token ──────────────────────────────────────────────────────────

    /// <summary>
    /// Position uses a local coordinate system per colour:
    ///   -1          = home base (not yet on the board)
    ///    0 … 51     = ring position (colour-relative; 0 = own start square)
    ///   52 … 56     = inside home lane (52 = first lane cell … 56 = last lane cell)
    ///   57          = finished (reached the centre)
    /// </summary>
    [Serializable]
    public struct TokenState
    {
        public int position;

        public bool IsHome     => position == LudoConstants.HOME_POSITION;
        public bool IsFinished => position == LudoConstants.FINISH_POSITION;
        public bool IsOnRing   => position >= 0 && position < LudoConstants.HOME_LANE_START;
        public bool IsInLane   => position >= LudoConstants.HOME_LANE_START && position < LudoConstants.FINISH_POSITION;

        public TokenState(int pos) { position = pos; }
    }

    // ─── Player ─────────────────────────────────────────────────────────

    [Serializable]
    public class PlayerState
    {
        public string      name;
        public PlayerColor color;
        public bool        isBot;
        public TokenState[] tokens;
        public int         rank;          // 0 = not yet ranked

        public PlayerState(string name, PlayerColor color, bool isBot)
        {
            this.name  = name;
            this.color = color;
            this.isBot = isBot;
            this.rank  = 0;
            tokens = new TokenState[LudoConstants.TOKENS_PER_PLAYER];
            for (int i = 0; i < tokens.Length; i++)
                tokens[i] = new TokenState(LudoConstants.HOME_POSITION);
        }

        public bool IsFinished()
        {
            for (int i = 0; i < tokens.Length; i++)
                if (!tokens[i].IsFinished) return false;
            return true;
        }

        public int FinishedCount()
        {
            int count = 0;
            for (int i = 0; i < tokens.Length; i++)
                if (tokens[i].IsFinished) count++;
            return count;
        }
    }

    // ─── Move Result ────────────────────────────────────────────────────

    [Serializable]
    public class MoveResult
    {
        public int            tokenIndex;
        public int            fromPosition;
        public int            toPosition;
        public int            diceValue;
        public bool           leftHome;
        public bool           reachedFinish;
        public bool           extraTurn;
        public List<CaptureInfo> captures = new List<CaptureInfo>();
    }

    [Serializable]
    public struct CaptureInfo
    {
        public PlayerColor color;
        public int         tokenIndex;
        public int         fromRingIndex;

        public CaptureInfo(PlayerColor c, int ti, int ri)
        {
            color = c; tokenIndex = ti; fromRingIndex = ri;
        }
    }

    // ─── Game Rules ─────────────────────────────────────────────────────

    [Serializable]
    public class LudoRules
    {
        public bool requireSixToLeaveHome   = true;
        public bool threeSixesLoseTurn      = true;
        public bool captureGrantsExtraTurn  = true;
        public bool finishGrantsExtraTurn   = true;
        public bool blockadesEnabled        = true;
        public bool rankedFinish            = true;
        public float turnDurationSeconds    = 30f;
    }

    // ─── Full Game State ────────────────────────────────────────────────

    [Serializable]
    public class LudoGameState
    {
        public PlayerState[] players;
        public int           activePlayerIndex;
        public GamePhase     phase;
        public int           diceValue;
        public int           consecutiveSixes;
        public List<int>     legalTokenIndexes = new List<int>();
        public int[]         winnerOrder;          // colour indexes in finish order
        public int           nextRank;
        public int           revision;
        public LudoRules     rules = new LudoRules();

        public PlayerState ActivePlayer => players[activePlayerIndex];
    }

    // ─── Utility ────────────────────────────────────────────────────────

    public static class LudoUtil
    {
        /// <summary>
        /// Converts a colour-relative ring position to the absolute 0‑51 ring index.
        /// Returns -1 if the position is not on the shared ring.
        /// </summary>
        public static int ToRingIndex(PlayerColor color, int position)
        {
            if (position < 0 || position >= LudoConstants.HOME_LANE_START) return -1;
            return (position + LudoConstants.START_RING_INDEX[(int)color]) % LudoConstants.RING_SIZE;
        }

        /// <summary>Is this absolute ring index a globally safe square?</summary>
        public static bool IsSafeRing(int ringIndex)
        {
            return ringIndex >= 0 && LudoConstants.SAFE_RING_INDEXES.Contains(ringIndex);
        }
    }
}
