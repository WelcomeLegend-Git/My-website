using System.Collections;
using UnityEngine;

namespace LudoKing3D
{
    /// <summary>
    /// Controls the dynamic camera for the board with smooth follow and screen shake capabilities.
    /// </summary>
    public class CameraController : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private float defaultHeight = 12f;
        [SerializeField] private float defaultAngle = 75f;
        [SerializeField] private float smoothSpeed = 5f;
        [SerializeField] private float shakeMagnitude = 0.15f;

        private Vector3 targetPosition;
        private Quaternion targetRotation;
        private Vector3 initialPosition;
        private Coroutine shakeCoroutine;

        private void Start()
        {
            ResetView();
            transform.position = targetPosition;
            transform.rotation = targetRotation;
        }

        private void LateUpdate()
        {
            if (shakeCoroutine == null)
            {
                transform.position = Vector3.Lerp(transform.position, targetPosition, Time.deltaTime * smoothSpeed);
                transform.rotation = Quaternion.Lerp(transform.rotation, targetRotation, Time.deltaTime * smoothSpeed);
            }
        }

        public void ResetView()
        {
            targetPosition = new Vector3(0, defaultHeight, -(defaultHeight / Mathf.Tan(defaultAngle * Mathf.Deg2Rad)));
            targetRotation = Quaternion.Euler(defaultAngle, 0, 0);
            initialPosition = targetPosition;
        }

        public void FocusOn(Vector3 worldPosition, float duration = 0.5f)
        {
            Vector3 offset = new Vector3(0, defaultHeight * 0.7f, -(defaultHeight * 0.7f / Mathf.Tan(defaultAngle * Mathf.Deg2Rad)));
            targetPosition = worldPosition + offset;
            targetRotation = Quaternion.Euler(defaultAngle, 0, 0);
        }

        public void ShakeCamera(float intensity = 0.3f, float duration = 0.25f)
        {
            if (shakeCoroutine != null)
                StopCoroutine(shakeCoroutine);
            
            shakeCoroutine = StartCoroutine(ShakeCoroutine(intensity, duration));
        }

        private IEnumerator ShakeCoroutine(float intensity, float duration)
        {
            float elapsed = 0.0f;
            Vector3 originalPos = transform.position;

            while (elapsed < duration)
            {
                float x = Random.Range(-1f, 1f) * intensity * shakeMagnitude;
                float y = Random.Range(-1f, 1f) * intensity * shakeMagnitude;

                transform.position = originalPos + new Vector3(x, y, 0);
                elapsed += Time.deltaTime;
                yield return null;
            }

            transform.position = originalPos;
            shakeCoroutine = null;
        }
    }
}
