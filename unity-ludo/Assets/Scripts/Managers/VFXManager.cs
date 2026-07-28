using UnityEngine;

namespace LudoKing3D
{
    /// <summary>
    /// Singleton manager for playing visual particle effects.
    /// </summary>
    public class VFXManager : MonoBehaviour
    {
        public static VFXManager Instance { get; private set; }

        [Header("Prefabs")]
        [SerializeField] private ParticleSystem captureExplosionPrefab;
        [SerializeField] private ParticleSystem sixBurstPrefab;
        [SerializeField] private ParticleSystem victoryConfettiPrefab;
        [SerializeField] private ParticleSystem finishSparklesPrefab;
        [SerializeField] private ParticleSystem trailPrefab;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void SpawnAndPlay(ParticleSystem prefab, Vector3 position, Color? overrideColor = null)
        {
            if (prefab == null) return;

            ParticleSystem ps = Instantiate(prefab, position, Quaternion.identity);
            
            if (overrideColor.HasValue)
            {
                var main = ps.main;
                main.startColor = overrideColor.Value;
            }
            
            ps.Play();
            Destroy(ps.gameObject, ps.main.duration + ps.main.startLifetime.constantMax);
        }

        public void PlayCapture(Vector3 position, Color color)
        {
            SpawnAndPlay(captureExplosionPrefab, position, color);
        }

        public void PlaySixBurst(Vector3 position)
        {
            SpawnAndPlay(sixBurstPrefab, position);
        }

        public void PlayVictory(Vector3 position)
        {
            SpawnAndPlay(victoryConfettiPrefab, position);
        }

        public void PlayFinishToken(Vector3 position, Color color)
        {
            SpawnAndPlay(finishSparklesPrefab, position, color);
        }
    }
}
