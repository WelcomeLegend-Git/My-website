using UnityEngine;

namespace LudoKing3D
{
    /// <summary>
    /// Singleton manager for audio clips and volume control.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class SoundManager : MonoBehaviour
    {
        public static SoundManager Instance { get; private set; }

        [Header("Audio Clips")]
        [SerializeField] private AudioClip diceRollClip;
        [SerializeField] private AudioClip tokenMoveClip;
        [SerializeField] private AudioClip tokenCaptureClip;
        [SerializeField] private AudioClip tokenFinishClip;
        [SerializeField] private AudioClip victoryClip;
        [SerializeField] private AudioClip turnChimeClip;
        [SerializeField] private AudioClip sixCelebrationClip;
        [SerializeField] private AudioClip buttonClickClip;
        [SerializeField] private AudioClip backgroundMusicClip;

        [Header("Audio Sources")]
        [SerializeField] private AudioSource sfxSource;
        [SerializeField] private AudioSource musicSource;

        [Header("Settings")]
        [SerializeField, Range(0f, 1f)] private float sfxVolume = 1f;
        [SerializeField, Range(0f, 1f)] private float musicVolume = 0.4f;

        public bool IsMuted { get; private set; }

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeSources();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeSources()
        {
            if (sfxSource == null)
                sfxSource = gameObject.AddComponent<AudioSource>();
            
            if (musicSource == null)
                musicSource = gameObject.AddComponent<AudioSource>();

            sfxSource.volume = sfxVolume;
            musicSource.volume = musicVolume;
            musicSource.loop = true;

            if (backgroundMusicClip != null)
            {
                musicSource.clip = backgroundMusicClip;
                musicSource.Play();
            }
        }

        private void PlayRandomPitch(AudioClip clip)
        {
            if (IsMuted || clip == null) return;
            sfxSource.pitch = Random.Range(0.95f, 1.05f);
            sfxSource.PlayOneShot(clip, sfxVolume);
        }

        public void PlayDiceRoll() => PlayRandomPitch(diceRollClip);
        
        public void PlayTokenMove() => PlayRandomPitch(tokenMoveClip);
        
        public void PlayCapture() => PlayRandomPitch(tokenCaptureClip);
        
        public void PlayFinish() => PlayRandomPitch(tokenFinishClip);
        
        public void PlayVictory() => PlayRandomPitch(victoryClip);
        
        public void PlayTurnChime() => PlayRandomPitch(turnChimeClip);
        
        public void PlaySixCelebration() => PlayRandomPitch(sixCelebrationClip);
        
        public void PlayButtonClick() => PlayRandomPitch(buttonClickClip);

        public void SetMuted(bool muted)
        {
            IsMuted = muted;
            musicSource.mute = IsMuted;
            sfxSource.mute = IsMuted;
        }

        public void ToggleMute()
        {
            SetMuted(!IsMuted);
        }
    }
}
