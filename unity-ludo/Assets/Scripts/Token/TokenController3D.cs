using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace LudoKing3D
{
    /// <summary>
    /// Controls the behavior, movement, and visual feedback of a Ludo token pawn in 3D space.
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class TokenController3D : MonoBehaviour
    {
        [Header("Movement Settings")]
        [SerializeField] private float moveDuration = 0.3f;
        [SerializeField] private float hopHeight = 0.6f;
        [SerializeField] private float multiHopDuration = 0.15f;
        [SerializeField] private AnimationCurve hopCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

        [Header("Visuals")]
        [SerializeField] private MeshRenderer meshRenderer;
        [SerializeField] private ParticleSystem trailParticle;
        [SerializeField] private Color selectionGlowColor = Color.white;
        [SerializeField] private AudioClip hopSound; // Added for audio support
        [SerializeField] private AudioSource audioSource; // Added for audio support

        public event Action<TokenController3D> OnClicked;

        // Properties
        public bool IsMoving { get; private set; }
        public PlayerColor Color { get; private set; }
        public int TokenIndex { get; private set; }

        private bool isSelectable = false;
        private Coroutine pulseCoroutine;
        private Material tokenMaterial;

        private void Awake()
        {
            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
                audioSource.playOnAwake = false;
            }
        }

        /// <summary>
        /// Initializes the token with its player color, index, and material.
        /// </summary>
        public void Initialize(PlayerColor color, int tokenIndex, Material material)
        {
            Color = color;
            TokenIndex = tokenIndex;
            
            if (meshRenderer != null)
            {
                meshRenderer.material = material;
                tokenMaterial = meshRenderer.material;
            }
        }

        /// <summary>
        /// Moves token from current position to destination using a parabolic arc coroutine.
        /// </summary>
        public void MoveTo(Vector3 destination, Action onComplete = null)
        {
            if (!gameObject.activeInHierarchy) return;
            StartCoroutine(MoveParabolaCoroutine(destination, moveDuration, onComplete));
        }

        /// <summary>
        /// Chains movement through multiple waypoints (for multi-cell moves).
        /// </summary>
        public void MoveAlongPath(Vector3[] waypoints, Action onComplete = null)
        {
            if (!gameObject.activeInHierarchy || waypoints == null || waypoints.Length == 0)
            {
                onComplete?.Invoke();
                return;
            }
            StartCoroutine(MoveAlongPathCoroutine(waypoints, onComplete));
        }

        /// <summary>
        /// Toggles selection highlight including pulse animation and emission glow.
        /// </summary>
        public void SetSelectable(bool selectable)
        {
            isSelectable = selectable;

            if (isSelectable)
            {
                if (pulseCoroutine == null)
                    pulseCoroutine = StartCoroutine(PulseRoutine());

                if (tokenMaterial != null)
                {
                    tokenMaterial.EnableKeyword("_EMISSION");
                    tokenMaterial.SetColor("_EmissionColor", selectionGlowColor);
                }
            }
            else
            {
                if (pulseCoroutine != null)
                {
                    StopCoroutine(pulseCoroutine);
                    pulseCoroutine = null;
                }
                transform.localScale = Vector3.one;

                if (tokenMaterial != null)
                {
                    tokenMaterial.DisableKeyword("_EMISSION");
                }
            }
        }

        /// <summary>
        /// Special capture animation: scales down, teleports, scales up.
        /// </summary>
        public void ReturnToHome(Vector3 homePosition, Action onComplete = null)
        {
            if (!gameObject.activeInHierarchy) return;
            StartCoroutine(CaptureRoutine(homePosition, onComplete));
        }

        /// <summary>
        /// Token reached finish animation.
        /// </summary>
        public void CelebrateFinish()
        {
            if (!gameObject.activeInHierarchy) return;
            StartCoroutine(CelebrateRoutine());
        }

        private void OnMouseDown()
        {
            if (isSelectable && !IsMoving)
            {
                OnClicked?.Invoke(this);
            }
        }

        private IEnumerator MoveParabolaCoroutine(Vector3 destination, float duration, Action onComplete = null)
        {
            IsMoving = true;
            Vector3 startPos = transform.position;
            float elapsed = 0f;

            if (trailParticle != null && !trailParticle.isPlaying)
                trailParticle.Play();

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float curveT = hopCurve.Evaluate(t);

                // Parabolic Y calculation
                float yOffset = hopHeight * 4f * t * (1f - t);

                Vector3 currentPos = Vector3.Lerp(startPos, destination, curveT);
                currentPos.y += yOffset;
                
                transform.position = currentPos;
                yield return null;
            }

            transform.position = destination;

            if (trailParticle != null && trailParticle.isPlaying)
                trailParticle.Stop();

            // Subtle squash-and-stretch bounce on arrival
            yield return SquashAndStretchRoutine();

            IsMoving = false;
            onComplete?.Invoke();
        }

        private IEnumerator MoveAlongPathCoroutine(Vector3[] waypoints, Action onComplete)
        {
            IsMoving = true;

            foreach (var waypoint in waypoints)
            {
                bool hopCompleted = false;
                PlayHopSound();
                StartCoroutine(MoveParabolaCoroutine(waypoint, multiHopDuration, () => hopCompleted = true));
                
                yield return new WaitUntil(() => hopCompleted);
            }

            IsMoving = false;
            onComplete?.Invoke();
        }

        private IEnumerator SquashAndStretchRoutine()
        {
            float duration = 0.15f;
            float elapsed = 0f;
            Vector3 originalScale = Vector3.one;
            Vector3 squashedScale = new Vector3(1f, 0.7f, 1f);

            // Squash down
            while (elapsed < duration / 2f)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / (duration / 2f);
                transform.localScale = Vector3.Lerp(originalScale, squashedScale, t);
                yield return null;
            }

            elapsed = 0f;

            // Stretch back up
            while (elapsed < duration / 2f)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / (duration / 2f);
                transform.localScale = Vector3.Lerp(squashedScale, originalScale, t);
                yield return null;
            }

            transform.localScale = originalScale;
        }

        private IEnumerator PulseRoutine()
        {
            Vector3 normalScale = Vector3.one;
            Vector3 largeScale = Vector3.one * 1.15f;
            float speed = 2f;

            while (isSelectable)
            {
                float t = (Mathf.Sin(Time.time * Mathf.PI * speed) + 1f) / 2f;
                transform.localScale = Vector3.Lerp(normalScale, largeScale, t);
                yield return null;
            }
            transform.localScale = normalScale;
        }

        private IEnumerator CaptureRoutine(Vector3 homePosition, Action onComplete)
        {
            IsMoving = true;
            float elapsed = 0f;
            float shrinkDuration = 0.3f;
            Vector3 startPos = transform.position;
            Vector3 upPos = startPos + Vector3.up * 2f;

            // Move up and scale down
            while (elapsed < shrinkDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / shrinkDuration;
                transform.position = Vector3.Lerp(startPos, upPos, t);
                transform.localScale = Vector3.Lerp(Vector3.one, Vector3.one * 0.3f, t);
                yield return null;
            }

            // Teleport to home
            transform.position = homePosition;
            
            // Scale back up
            elapsed = 0f;
            while (elapsed < shrinkDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / shrinkDuration;
                transform.localScale = Vector3.Lerp(Vector3.one * 0.3f, Vector3.one, t);
                yield return null;
            }

            transform.localScale = Vector3.one;
            IsMoving = false;
            onComplete?.Invoke();
        }

        private IEnumerator CelebrateRoutine()
        {
            if (trailParticle != null)
                trailParticle.Play(); // Burst particle effect

            float elapsed = 0f;
            float spinDuration = 1.0f;
            Vector3 startScale = transform.localScale;
            Vector3 endScale = startScale * 1.2f;
            Quaternion startRot = transform.rotation;

            while (elapsed < spinDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / spinDuration;
                
                // Spin 360 on Y
                transform.rotation = startRot * Quaternion.Euler(0, 360f * t, 0);
                
                // Scale up and back down
                float scaleT = Mathf.Sin(t * Mathf.PI);
                transform.localScale = Vector3.Lerp(startScale, endScale, scaleT);
                
                yield return null;
            }

            transform.rotation = startRot;
            transform.localScale = startScale;
        }

        private void PlayHopSound()
        {
            if (audioSource != null && hopSound != null)
            {
                audioSource.PlayOneShot(hopSound);
            }
        }
    }
}
