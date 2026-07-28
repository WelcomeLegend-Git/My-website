using UnityEngine;
using System;
using System.Collections;

namespace LudoKing3D
{
    /// <summary>
    /// A physics-based 3D dice controller for rolling dice and determining results.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    [RequireComponent(typeof(MeshRenderer))]
    public class DiceController3D : MonoBehaviour
    {
        [SerializeField] private float rollForce = 8f;
        [SerializeField] private float rollTorque = 15f;
        [SerializeField] private float settleVelocityThreshold = 0.05f;
        [SerializeField] private float settleAngularThreshold = 0.1f;
        [SerializeField] private Vector3 diceStartPosition = new Vector3(0, 5f, 0);
        [SerializeField] private Vector3 diceStartRotation = Vector3.zero;
        
        [Tooltip("Assign exactly 6 child transforms representing the centers of each face.")]
        [SerializeField] private Transform[] faceTransforms;
        
        [Tooltip("The values corresponding to each faceTransform (1-6). Opposite faces should sum to 7.")]
        [SerializeField] private int[] faceValues = { 1, 6, 2, 5, 3, 4 };
        
        [SerializeField] private Material diceMaterial;
        [SerializeField] private Color glowColor = Color.yellow;
        [SerializeField] private Color normalColor = Color.white;

        private Rigidbody _rb;
        private MeshRenderer _meshRenderer;
        private Coroutine _rollCoroutine;
        private Material _instancedMaterial;

        public event Action<int> OnDiceResult;
        public event Action OnRollStarted;

        public bool IsRolling { get; private set; }
        public int LastValue { get; private set; } = 1;

        private void Awake()
        {
            _rb = GetComponent<Rigidbody>();
            _meshRenderer = GetComponent<MeshRenderer>();
            
            if (diceMaterial != null)
            {
                _instancedMaterial = new Material(diceMaterial);
                _meshRenderer.material = _instancedMaterial;
            }
            
            ResetPosition();
            SetGlow(true);
        }

        /// <summary>
        /// Initiates a physics roll by applying random forces and torques.
        /// </summary>
        public void Roll()
        {
            if (IsRolling) return;
            
            IsRolling = true;
            SetGlow(false);
            OnRollStarted?.Invoke();

            ResetPosition();

            // Apply random forces
            Vector3 randomDirection = UnityEngine.Random.insideUnitSphere.normalized;
            // Bias upwards
            randomDirection.y = Mathf.Abs(randomDirection.y) + 0.5f; 
            
            Vector3 force = randomDirection * rollForce;
            Vector3 torque = UnityEngine.Random.insideUnitSphere * rollTorque;

            _rb.isKinematic = false;
            _rb.AddForce(force, ForceMode.Impulse);
            _rb.AddTorque(torque, ForceMode.Impulse);

            if (_rollCoroutine != null)
                StopCoroutine(_rollCoroutine);
                
            _rollCoroutine = StartCoroutine(WaitForDiceSettle());
        }

        /// <summary>
        /// Waits until the dice has stopped moving to read the top face.
        /// </summary>
        private IEnumerator WaitForDiceSettle()
        {
            // Give it a brief moment to start moving
            yield return new WaitForSeconds(0.5f);

            // Wait until velocity drops below threshold
            while (_rb.velocity.sqrMagnitude > settleVelocityThreshold * settleVelocityThreshold ||
                   _rb.angularVelocity.sqrMagnitude > settleAngularThreshold * settleAngularThreshold)
            {
                yield return null;
            }

            // Small delay to ensure it's completely settled
            yield return new WaitForSeconds(0.2f);
            
            _rb.isKinematic = true;
            IsRolling = false;

            LastValue = ReadTopFace();
            OnDiceResult?.Invoke(LastValue);
            
            SetGlow(true);
        }

        /// <summary>
        /// Determines which face is pointing upwards by comparing face normals with Vector3.up.
        /// </summary>
        private int ReadTopFace()
        {
            if (faceTransforms == null || faceTransforms.Length != 6 || faceValues.Length != 6)
            {
                Debug.LogError("Dice face transforms or values are not correctly assigned!");
                return 1;
            }

            int topFaceValue = 1;
            float maxDot = -Mathf.Infinity;

            for (int i = 0; i < 6; i++)
            {
                // Vector from dice center to face center
                Vector3 faceDirection = (faceTransforms[i].position - transform.position).normalized;
                float dotProduct = Vector3.Dot(faceDirection, Vector3.up);

                if (dotProduct > maxDot)
                {
                    maxDot = dotProduct;
                    topFaceValue = faceValues[i];
                }
            }

            return topFaceValue;
        }

        /// <summary>
        /// Toggles the visual glow of the dice.
        /// </summary>
        public void SetGlow(bool active)
        {
            if (_instancedMaterial != null && _instancedMaterial.HasProperty("_EmissionColor"))
            {
                if (active)
                {
                    _instancedMaterial.EnableKeyword("_EMISSION");
                    _instancedMaterial.SetColor("_EmissionColor", glowColor);
                }
                else
                {
                    _instancedMaterial.SetColor("_EmissionColor", Color.black);
                }
            }
        }

        /// <summary>
        /// Resets the dice to its starting position and rotation.
        /// </summary>
        public void ResetPosition()
        {
            _rb.isKinematic = true;
            transform.position = diceStartPosition;
            transform.eulerAngles = diceStartRotation;
            _rb.velocity = Vector3.zero;
            _rb.angularVelocity = Vector3.zero;
        }
        
        private void OnDestroy()
        {
            if (_instancedMaterial != null)
            {
                Destroy(_instancedMaterial);
            }
        }
    }
}
