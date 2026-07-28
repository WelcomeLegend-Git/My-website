using UnityEngine;
using System.Collections.Generic;

namespace LudoKing3D
{
    /// <summary>
    /// Maps logical Ludo board positions to 3D world coordinates.
    /// The board is a 15x15 grid centered at the origin, lying on the XZ plane.
    /// </summary>
    public class BoardPathManager : MonoBehaviour
    {
        [SerializeField] private float boardScale = 1.0f;
        [SerializeField] private Vector3 boardCenter = Vector3.zero;

        private Vector3[] _ringCells;
        private Dictionary<PlayerColor, Vector3[]> _homeLanes;
        private Dictionary<PlayerColor, Vector3[]> _homeBases;
        private Dictionary<PlayerColor, Vector3> _finishPositions;

        private void Awake()
        {
            InitializeRingPath();
            InitializeHomeLanes();
            InitializeHomeBases();
            InitializeFinishPositions();
        }

        private void InitializeRingPath()
        {
            _ringCells = new Vector3[52];
            
            // Standard Ludo ring path coordinates (X, 0, Z)
            Vector3[] rawPath = new Vector3[]
            {
                new Vector3(-6, 0, 1),  new Vector3(-5, 0, 1),  new Vector3(-4, 0, 1),  new Vector3(-3, 0, 1),  new Vector3(-2, 0, 1),
                new Vector3(-1, 0, 2),  new Vector3(-1, 0, 3),  new Vector3(-1, 0, 4),  new Vector3(-1, 0, 5),  new Vector3(-1, 0, 6),
                new Vector3(-1, 0, 7),  new Vector3(0, 0, 7),   new Vector3(1, 0, 7),   new Vector3(1, 0, 6),   new Vector3(1, 0, 5),
                new Vector3(1, 0, 4),   new Vector3(1, 0, 3),   new Vector3(1, 0, 2),   new Vector3(2, 0, 1),   new Vector3(3, 0, 1),
                new Vector3(4, 0, 1),   new Vector3(5, 0, 1),   new Vector3(6, 0, 1),   new Vector3(7, 0, 1),   new Vector3(7, 0, 0),
                new Vector3(7, 0, -1),  new Vector3(6, 0, -1),  new Vector3(5, 0, -1),  new Vector3(4, 0, -1),  new Vector3(3, 0, -1),
                new Vector3(2, 0, -1),  new Vector3(1, 0, -2),  new Vector3(1, 0, -3),  new Vector3(1, 0, -4),  new Vector3(1, 0, -5),
                new Vector3(1, 0, -6),  new Vector3(1, 0, -7),  new Vector3(0, 0, -7),  new Vector3(-1, 0, -7), new Vector3(-1, 0, -6),
                new Vector3(-1, 0, -5), new Vector3(-1, 0, -4), new Vector3(-1, 0, -3), new Vector3(-1, 0, -2), new Vector3(-2, 0, -1),
                new Vector3(-3, 0, -1), new Vector3(-4, 0, -1), new Vector3(-5, 0, -1), new Vector3(-6, 0, -1), new Vector3(-7, 0, -1),
                new Vector3(-7, 0, 0),  new Vector3(-7, 0, 1)
            };

            for (int i = 0; i < 52; i++)
            {
                _ringCells[i] = ApplyTransform(rawPath[i]);
            }
        }

        private void InitializeHomeLanes()
        {
            _homeLanes = new Dictionary<PlayerColor, Vector3[]>();

            _homeLanes[PlayerColor.Red] = new Vector3[] {
                ApplyTransform(new Vector3(-6, 0, 0)), ApplyTransform(new Vector3(-5, 0, 0)),
                ApplyTransform(new Vector3(-4, 0, 0)), ApplyTransform(new Vector3(-3, 0, 0)), ApplyTransform(new Vector3(-2, 0, 0))
            };

            _homeLanes[PlayerColor.Blue] = new Vector3[] {
                ApplyTransform(new Vector3(0, 0, 6)), ApplyTransform(new Vector3(0, 0, 5)),
                ApplyTransform(new Vector3(0, 0, 4)), ApplyTransform(new Vector3(0, 0, 3)), ApplyTransform(new Vector3(0, 0, 2))
            };

            _homeLanes[PlayerColor.Yellow] = new Vector3[] {
                ApplyTransform(new Vector3(6, 0, 0)), ApplyTransform(new Vector3(5, 0, 0)),
                ApplyTransform(new Vector3(4, 0, 0)), ApplyTransform(new Vector3(3, 0, 0)), ApplyTransform(new Vector3(2, 0, 0))
            };

            _homeLanes[PlayerColor.Green] = new Vector3[] {
                ApplyTransform(new Vector3(0, 0, -6)), ApplyTransform(new Vector3(0, 0, -5)),
                ApplyTransform(new Vector3(0, 0, -4)), ApplyTransform(new Vector3(0, 0, -3)), ApplyTransform(new Vector3(0, 0, -2))
            };
        }

        private void InitializeHomeBases()
        {
            _homeBases = new Dictionary<PlayerColor, Vector3[]>();

            // Offsets for tokens within their 3x3 home base area
            Vector3[] tokenOffsets = new Vector3[] {
                new Vector3(-1.5f, 0, 1.5f), new Vector3(1.5f, 0, 1.5f),
                new Vector3(-1.5f, 0, -1.5f), new Vector3(1.5f, 0, -1.5f)
            };

            _homeBases[PlayerColor.Red] = CreateHomeBaseTokens(new Vector3(-4.5f, 0, -4.5f), tokenOffsets);
            _homeBases[PlayerColor.Blue] = CreateHomeBaseTokens(new Vector3(-4.5f, 0, 4.5f), tokenOffsets);
            _homeBases[PlayerColor.Yellow] = CreateHomeBaseTokens(new Vector3(4.5f, 0, 4.5f), tokenOffsets);
            _homeBases[PlayerColor.Green] = CreateHomeBaseTokens(new Vector3(4.5f, 0, -4.5f), tokenOffsets);
        }

        private Vector3[] CreateHomeBaseTokens(Vector3 center, Vector3[] offsets)
        {
            Vector3[] tokens = new Vector3[4];
            for (int i = 0; i < 4; i++)
            {
                tokens[i] = ApplyTransform(center + offsets[i] * 0.5f);
            }
            return tokens;
        }

        private void InitializeFinishPositions()
        {
            _finishPositions = new Dictionary<PlayerColor, Vector3>
            {
                { PlayerColor.Red, ApplyTransform(new Vector3(-0.5f, 0, 0)) },
                { PlayerColor.Blue, ApplyTransform(new Vector3(0, 0, 0.5f)) },
                { PlayerColor.Yellow, ApplyTransform(new Vector3(0.5f, 0, 0)) },
                { PlayerColor.Green, ApplyTransform(new Vector3(0, 0, -0.5f)) }
            };
        }

        private Vector3 ApplyTransform(Vector3 localPos)
        {
            return boardCenter + (localPos * boardScale);
        }

        /// <summary>
        /// Converts logical position to world Vector3.
        /// position -1 means home base, 0-51 is ring path, 52-56 is home lane, 57 is finish.
        /// </summary>
        public Vector3 GetWorldPosition(PlayerColor color, int position, int tokenIndex)
        {
            if (position < 0) return GetHomeBasePosition(color, tokenIndex);
            
            if (position < 52)
            {
                int absIndex = GetAbsoluteRingIndex(color, position);
                return _ringCells[absIndex];
            }
            
            if (position < 57)
            {
                int laneIndex = position - 52;
                return _homeLanes[color][laneIndex];
            }
            
            return GetFinishPosition(color);
        }

        /// <summary>
        /// Returns the home slot position for a specific color and token index.
        /// </summary>
        public Vector3 GetHomeBasePosition(PlayerColor color, int tokenIndex)
        {
            return _homeBases[color][Mathf.Clamp(tokenIndex, 0, 3)];
        }

        /// <summary>
        /// Returns the finish position, slightly offset per color to avoid overlap.
        /// </summary>
        public Vector3 GetFinishPosition(PlayerColor color)
        {
            return _finishPositions[color];
        }

        /// <summary>
        /// Returns all 52 ring positions in order.
        /// </summary>
        public Vector3[] GetRingPath()
        {
            return _ringCells;
        }

        /// <summary>
        /// Returns the 5 home lane positions for the given color.
        /// </summary>
        public Vector3[] GetHomeLanePath(PlayerColor color)
        {
            return _homeLanes[color];
        }

        /// <summary>
        /// Wraps LudoUtil.ToRingIndex to get the absolute ring index (0-51) based on a relative position (0-51).
        /// </summary>
        public int GetAbsoluteRingIndex(PlayerColor color, int relativePosition)
        {
            // Assuming LudoUtil.ToRingIndex exists in LudoTypes.cs as requested
            // If it doesn't, this logic handles standard ludo mapping:
            // return (relativePosition + GetColorStartIndex(color)) % 52;
            
            return LudoUtil.ToRingIndex(color, relativePosition);
        }
    }
}
