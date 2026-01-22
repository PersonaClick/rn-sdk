import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  View,
  Image,
  ActivityIndicator,
  Pressable,
  Text,
  Platform,
  StyleSheet,
  Dimensions,
} from 'react-native'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { VolumeManager, getRingerMode, RINGER_MODE } from 'react-native-volume-manager'
import StoryElements from './StoryElements'
import { styles, getDuration, preloadMedia, hexToRgb, DEFAULT_COLORS } from './styles'
import { getCachedImage, isImageCached } from '../../lib/stories/imageCache'
import { getCachedVideoPath, isVideoCached, getVideoDuration } from '../../lib/stories/videoCache'

// Note: react-native-video will be added as dependency
// For now, we'll use a placeholder that can be replaced
let Video = null
try {
  Video = require('react-native-video').default
} catch (error) {
  console.warn('react-native-video not installed. Video slides will not work.')
}

/**
 * StorySlide Component
 * Renders individual slide content with image/video and interactive elements
 * 
 * @param {Object} props
 * @param {Slide} props.slide - Slide data object
 * @param {boolean} props.isActive - Whether slide is currently active
 * @param {Function} props.onElementPress - Callback when element is pressed
 * @param {Object} [props.settings] - Stories settings from API (colors, etc.)
 * @param {Function} props.onLoad - Callback when slide loads
 * @param {Object} [props.style] - Additional styles
 */
/**
 * Determine initial mute state based on system silent mode
 * Uses react-native-volume-manager to check device mute/silent state
 * For iOS: Checks mute switch state using addSilentListener
 * For Android: Checks ringer mode (SILENT, VIBRATE, or NORMAL)
 */
const getInitialMuteState = async () => {
  try {
    if (Platform.OS === 'ios') {
      // For iOS: Check mute switch state
      // Use addSilentListener to get initial state
      return new Promise((resolve) => {
        let resolved = false
        const listener = VolumeManager.addSilentListener((status) => {
          // status.isMuted indicates if device is in silent mode
          // status.initialQuery indicates if this is the initial query
          if (status.initialQuery && !resolved) {
            resolved = true
            listener.remove()
            // isMuted === true means device is in silent mode (muted)
            // isMuted === false means device is not in silent mode (unmuted)
            // isMuted === undefined means unknown, default to muted
            resolve(status.isMuted === true)
          }
        })
        // Timeout fallback: if no response in 1 second, default to muted
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            listener.remove()
            resolve(true) // Default to muted
          }
        }, 1000)
      })
    } else if (Platform.OS === 'android') {
      // For Android: Check ringer mode
      // RINGER_MODE.silent or RINGER_MODE.vibrate means device is in silent mode
      const ringerMode = await getRingerMode()
      // Check if ringer mode is silent or vibrate
      // RINGER_MODE values: silent = 0, vibrate = 1, normal = 2
      if (ringerMode === RINGER_MODE.silent || ringerMode === RINGER_MODE.vibrate) {
        return true // Device is in silent/vibrate mode = muted
      }
      // RINGER_MODE.normal or undefined = not muted
      return false
    }
  } catch (error) {
    // If check fails, default to muted (better UX)
    if (__DEV__) {
      console.warn('[StorySlide] Failed to check system mute state:', error)
    }
    return true // Default to muted
  }
  // Fallback: default to muted
  return true
}

function StorySlide({ slide, isActive, onElementPress, onLoad, onMediaLoaded, onVideoDuration, onVideoEnd, onVideoProgress, settings, style }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [mediaLoading, setMediaLoading] = useState(true)
  const [muted, setMuted] = useState(true) // Initial state (will be updated from system detection)
  const [videoSource, setVideoSource] = useState(null) // Cached video path or original URL
  const [videoIsCached, setVideoIsCached] = useState(false) // Track if video is from cache
  const [videoOpacityReady, setVideoOpacityReady] = useState(false) // Track when video opacity can be shown (with delay)
  // Use ref instead of state for aspectRatio to prevent re-renders that cause jumps
  const videoAspectRatioRef = useRef(null)
  const slideIdRef = useRef(null)
  const mediaLoadedCallbackRef = useRef(onMediaLoaded)
  const muteStateInitializedRef = useRef(false)
  const videoOpacityTimeoutRef = useRef(null) // Timeout for opacity delay

  // Update callback ref when it changes
  useEffect(() => {
    mediaLoadedCallbackRef.current = onMediaLoaded
  }, [onMediaLoaded])

  // Initialize mute state from system detection
  useEffect(() => {
    if (!muteStateInitializedRef.current) {
      muteStateInitializedRef.current = true
      getInitialMuteState().then((isMuted) => {
        setMuted(isMuted)
      }).catch((error) => {
        if (__DEV__) {
          console.warn('[StorySlide] Failed to initialize mute state:', error)
        }
        // Keep default muted state on error
      })
    }
  }, [])

  useEffect(() => {
    // Check if slide actually changed
    const slideChanged = slideIdRef.current !== slide?.id
    
    if (slide && isActive) {
      // Reset loading state when slide changes
      if (slideChanged) {
        slideIdRef.current = slide.id
        setImageLoaded(false)
        setVideoLoaded(false)
        setVideoOpacityReady(false) // Reset opacity ready state
        setMediaLoading(true)
        setVideoIsCached(false) // Reset cache status
        videoAspectRatioRef.current = null // Reset aspectRatio ref for new slide
        
        // Clear opacity timeout if exists
        if (videoOpacityTimeoutRef.current) {
          clearTimeout(videoOpacityTimeoutRef.current)
          videoOpacityTimeoutRef.current = null
        }
        
        // For video slides, check cache first, then fallback to original URL
        if (slide.type === 'video' && slide.background) {
          if (__DEV__) {
            console.log(`[StorySlide] Checking cache for video slide ${slide.id} (type: ${typeof slide.id})`)
          }
          // Check cache first - if cached, use it immediately for instant playback
          // Use async/await pattern to ensure we wait for the result
          ;(async () => {
            try {
              const cached = await isVideoCached(slide.id)
              if (__DEV__) {
                console.log(`[StorySlide] Cache check result for slide ${slide.id}: ${cached}`)
              }
              if (cached) {
                // Video is cached - get cached path and use it immediately
                const cachedPath = await getCachedVideoPath(slide.id, slide.background)
                if (cachedPath) {
                  if (__DEV__) {
                    console.log(`[StorySlide] Using cached video for slide ${slide.id}: ${cachedPath}`)
                  }
                  setVideoIsCached(true)
                  setVideoSource({ uri: cachedPath })
                  // For cached videos, mark as loaded immediately to start playback faster
                  // Video component will still fire onReadyForDisplay, but we don't wait for it
                  setVideoLoaded(true)
                  setMediaLoading(false)
                  setTimeout(() => {
                    mediaLoadedCallbackRef.current?.()
                    onLoad?.()
                  }, 0)
                } else {
                  if (__DEV__) {
                    console.warn(`[StorySlide] Cached path not found for slide ${slide.id}, using original URL`)
                  }
                  // Fallback to original URL if cached path not found
                  setVideoSource({ uri: slide.background })
                }
              } else {
                if (__DEV__) {
                  console.log(`[StorySlide] Video not cached for slide ${slide.id}, using streaming`)
                }
                // Not cached - use original URL for streaming
                setVideoSource({ uri: slide.background })
              }
            } catch (error) {
              if (__DEV__) {
                console.warn('[StorySlide] Error checking video cache:', error)
              }
              // Fallback to original URL on error
              setVideoSource({ uri: slide.background })
            }
          })()
        } else {
          // For non-video slides, reset video source
          setVideoSource(null)
        }
        
        // Reset mute state to initial value when slide changes
        // Check system silent mode for each new slide
        // For video slides, ensure muted state matches device silent mode
        if (slide.type === 'video') {
          getInitialMuteState().then((isMuted) => {
            if (__DEV__) {
              console.log(`[StorySlide] Setting muted=${isMuted} for video slide ${slide.id} based on device silent mode`)
            }
            setMuted(isMuted)
          }).catch((error) => {
            if (__DEV__) {
              console.warn('[StorySlide] Failed to check mute state on slide change:', error)
            }
            // Keep current state or default to muted on error
            setMuted(true)
          })
        } else {
          // For non-video slides, reset to default muted state
          setMuted(true)
        }
        // Clear any pending video load timeout
        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current)
          videoLoadTimeoutRef.current = null
        }
      } else if (slide && isActive && slide.type === 'video') {
        // When slide becomes active (but didn't change), check mute state for video slides
        // This ensures video opens with correct mute state based on device silent mode
        getInitialMuteState().then((isMuted) => {
          if (__DEV__) {
            console.log(`[StorySlide] Updating muted=${isMuted} for active video slide ${slide.id} based on device silent mode`)
          }
          setMuted(isMuted)
        }).catch((error) => {
          if (__DEV__) {
            console.warn('[StorySlide] Failed to check mute state when slide became active:', error)
          }
          // Keep current state or default to muted on error
          setMuted(true)
        })
      }

      // If slide has no background media, mark as loaded immediately
      if (!slide.background) {
        setMediaLoading(false)
        setImageLoaded(true)
        setVideoLoaded(true)
        setTimeout(() => {
          mediaLoadedCallbackRef.current?.()
          onLoad?.()
        }, 0)
        return
      }
      
      // For images, use Image.getSize to check if image is available
      if (slide.type !== 'video' && slide.background) {
        // Try to get image size - this will succeed if image is cached or can be loaded
        Image.getSize(
          slide.background,
          (width, height) => {
            // If we can get size, image is ready - set loaded immediately
            setImageLoaded(true)
            setMediaLoading(false)
            // Always call callback when image is ready, even if already loaded
            setTimeout(() => {
              mediaLoadedCallbackRef.current?.()
              onLoad?.()
            }, 0)
          },
          (error) => {
            // Continue with normal loading flow - onLoad should fire
          }
        )
        
        // Also try prefetch as backup
        Image.prefetch(slide.background)
          .then(() => {
            // Prefetch success doesn't guarantee onLoad will fire, so don't set loaded here
          })
          .catch((error) => {
            // Silent fail - will use onLoad event
          })
      }
      
      // Preload preview
      if (slide.preview) {
        preloadMedia(slide.preview)
      }
      
      // Timeout: if image doesn't load in 2 seconds, show it anyway
      const timeoutId = setTimeout(() => {
        setImageLoaded((prevLoaded) => {
          if (!prevLoaded && slide.type !== 'video') {
            // Call callback when timeout forces image to show
            setTimeout(() => {
              mediaLoadedCallbackRef.current?.()
            }, 0)
            return true
          }
          return prevLoaded
        })
      }, 2000)
      
      return () => {
        clearTimeout(timeoutId)
        // Also clear video load timeout on cleanup
        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current)
          videoLoadTimeoutRef.current = null
        }
        // Also clear opacity timeout on cleanup
        if (videoOpacityTimeoutRef.current) {
          clearTimeout(videoOpacityTimeoutRef.current)
          videoOpacityTimeoutRef.current = null
        }
      }
    } else if (!slide) {
      // Reset when slide is null
      slideIdRef.current = null
      setImageLoaded(false)
      setVideoLoaded(false)
      setVideoOpacityReady(false) // Reset opacity ready state
      setMediaLoading(true)
      videoAspectRatioRef.current = null // Reset aspectRatio ref
      
      // Clear opacity timeout if exists
      if (videoOpacityTimeoutRef.current) {
        clearTimeout(videoOpacityTimeoutRef.current)
        videoOpacityTimeoutRef.current = null
      }
      // Clear video load timeout
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current)
        videoLoadTimeoutRef.current = null
      }
    }
    
    // Cleanup function - clear timeouts on unmount
    return () => {
      if (videoOpacityTimeoutRef.current) {
        clearTimeout(videoOpacityTimeoutRef.current)
        videoOpacityTimeoutRef.current = null
      }
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current)
        videoLoadTimeoutRef.current = null
      }
    }
  }, [slide?.id, isActive]) // Use slide?.id to track slide changes more reliably

  useEffect(() => {
    // Check if media is loaded
    const isMediaLoaded = slide?.type === 'video' ? videoLoaded : imageLoaded
    
    if (isMediaLoaded && mediaLoading) {
      // Immediately hide loader when media is loaded
      setMediaLoading(false)
      // Call callbacks
      onMediaLoaded?.()
      onLoad?.()
    } else if (!isMediaLoaded && !mediaLoading && slide) {
      // If media is not loaded but loader is hidden, show loader again
      setMediaLoading(true)
    }
  }, [imageLoaded, videoLoaded, slide?.type, slide?.id])

  const handleImageLoad = useCallback((event) => {
    setImageLoaded(true)
    setMediaLoading(false)
    // Always call callback when image loads
    setTimeout(() => {
      mediaLoadedCallbackRef.current?.()
      onLoad?.()
    }, 0)
  }, [onLoad])

  const handleImageLoadEnd = useCallback(() => {
    // Fallback: if onLoad didn't fire, consider loaded when onLoadEnd fires
    setImageLoaded((prevLoaded) => {
      if (!prevLoaded) {
        setMediaLoading(false)
        // Call callback when load ends
        setTimeout(() => {
          mediaLoadedCallbackRef.current?.()
        }, 0)
        return true
      }
      return prevLoaded
    })
  }, [])

  const handleImageError = useCallback((error) => {
    console.warn('[StorySlide] Image load error:', error, slide?.background)
    setImageLoaded(true) // Still consider loaded to show fallback
  }, [slide?.background])

  const videoLoadTimeoutRef = useRef(null)

  const handleVideoLoad = useCallback((data) => {
    // onLoad fires when metadata is loaded, including duration and naturalSize
    // According to react-native-video documentation: data.duration is always in SECONDS
    if (__DEV__) {
      console.log(`[StorySlide] Video onLoad fired for slide ${slide?.id}`, data)
    }
    if (data && slide?.id) {
      const duration = data.duration
      
      // Get naturalSize to calculate aspect ratio
      // Store in ref instead of state to prevent re-renders that cause jumps
      // We'll use it to determine resizeMode, but won't trigger React re-render
      if (data.naturalSize && data.naturalSize.width && data.naturalSize.height) {
        const aspectRatio = data.naturalSize.width / data.naturalSize.height
        const previousAspectRatio = videoAspectRatioRef.current
        videoAspectRatioRef.current = aspectRatio // Store in ref, not state
        
        if (__DEV__) {
          console.log(`[StorySlide] Video onLoad - aspectRatio: ${aspectRatio.toFixed(2)} (${data.naturalSize.width}x${data.naturalSize.height}) for slide ${slide.id}`)
          console.log(`[StorySlide] Stored aspectRatio in ref (not state) to prevent re-renders`)
          console.log(`[StorySlide] Previous aspectRatio: ${previousAspectRatio}, New aspectRatio: ${aspectRatio.toFixed(2)}`)
          console.log(`[StorySlide] resizeMode should be: ${aspectRatio < 1 ? 'cover' : 'contain'}, but using fixed "contain" to prevent jumps`)
        }
        
        // Note: We're not updating resizeMode dynamically to prevent jumps
        // Video will use resizeMode="contain" which works for all videos
      }
      
      // Check if duration is valid (number, positive, not NaN, finite)
      if (typeof duration === 'number' && !isNaN(duration) && isFinite(duration) && duration > 0) {
        // Duration is in seconds, pass it as-is to parent component
        if (__DEV__) {
          console.log(`[StorySlide] Video duration: ${duration.toFixed(3)}s (${(duration * 1000).toFixed(0)}ms) for slide ${slide.id}`)
        }
        onVideoDuration?.(duration, slide.id)
      } else if (__DEV__) {
        console.warn(`[StorySlide] Invalid video duration: ${duration} for slide ${slide.id}`)
      }
    }
    // Don't set videoLoaded here - wait for onReadyForDisplay
    // This ensures video is truly ready before starting the progress timer
  }, [onVideoDuration, slide?.id])

  const handleVideoReadyForDisplay = useCallback(() => {
    // This fires when video is actually ready to play
    // For cached videos, we already set videoLoaded=true, but this confirms it's ready
    // Clear the fallback timeout since we're ready
    if (__DEV__) {
      console.log(`[StorySlide] Video ready for display: slide ${slide?.id}`)
      // Read current aspectRatio from state at call time, don't include in dependencies
      // Including videoAspectRatio in dependencies causes callback to be recreated when it changes
      // This might cause issues if callback is called with stale closure
      console.log(`[StorySlide] Current state - videoLoaded: ${videoLoaded}, videoIsCached: ${videoIsCached}`)
    }
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current)
      videoLoadTimeoutRef.current = null
    }
    setVideoLoaded(true)
    setMediaLoading(false)
    
    // Clear any existing opacity timeout
    if (videoOpacityTimeoutRef.current) {
      clearTimeout(videoOpacityTimeoutRef.current)
    }
    
    // Add 50ms delay before showing video to allow it to stabilize
    // This prevents visual jumps that occur when video changes size after initial render
    videoOpacityTimeoutRef.current = setTimeout(() => {
      if (__DEV__) {
        console.log(`[StorySlide] Setting videoOpacityReady=true after 50ms delay for slide ${slide?.id}`)
      }
      setVideoOpacityReady(true)
    }, 50)
    
    // Notify parent that media is loaded
    if (mediaLoadedCallbackRef.current) {
      mediaLoadedCallbackRef.current()
    }
  }, [slide?.id, videoLoaded, videoIsCached])

  const handleVideoError = useCallback((error) => {
    console.warn('[StorySlide] Video load error:', error, slide?.background, slide?.id)
    setVideoLoaded(true) // Still consider loaded to show fallback
  }, [slide?.background, slide?.id])

  const handleVideoEnd = useCallback(() => {
    // Video playback ended - notify parent to move to next slide
    if (__DEV__) {
      console.log(`[StorySlide] Video ended for slide ${slide?.id}`)
    }
    onVideoEnd?.()
  }, [onVideoEnd, slide?.id])

  const handleVideoProgress = useCallback((data) => {
    // Report video playback progress to parent for synchronization
    // data.currentTime is in seconds
    if (data?.currentTime !== undefined && slide?.id) {
      onVideoProgress?.(data.currentTime, slide.id)
    }
  }, [onVideoProgress, slide?.id])

  const handleToggleMute = useCallback(() => {
    setMuted(prev => !prev)
  }, [])

  // Calculate resizeMode based on aspectRatio from ref (not state)
  // This allows us to use correct resizeMode without causing re-renders
  // For vertical videos (aspectRatio < 1), use "cover" to fill screen height
  // For horizontal videos (aspectRatio >= 1), use "contain" to show full video
  // Use "contain" as default until aspectRatio is known
  const videoResizeMode = useMemo(() => {
    const aspectRatio = videoAspectRatioRef.current
    if (aspectRatio === null) {
      return "contain" // Safe default
    }
    return aspectRatio < 1 ? "cover" : "contain"
  }, []) // Empty deps - we'll read from ref, not state
  
  // Log resizeMode calculation
  if (__DEV__) {
    const aspectRatio = videoAspectRatioRef.current
    console.log(`[StorySlide] videoResizeMode: ${videoResizeMode} (aspectRatio from ref: ${aspectRatio}, slide: ${slide?.id})`)
  }

  // Memoize background rendering to avoid recreation on every render
  // IMPORTANT: Do NOT include videoAspectRatio or videoResizeMode in dependencies
  // This prevents backgroundElement from recalculating when aspectRatio changes
  // We use fixed resizeMode="contain" to prevent any changes
  const backgroundElement = useMemo(() => {
    if (__DEV__) {
      console.log(`[StorySlide] backgroundElement useMemo recalculating - slide: ${slide?.id}`)
    }
    if (!slide?.background) {
      return null
    }
    
    if (slide.type === 'video' && Video) {
      // Use videoSource if set, otherwise fallback to original URL
      // videoSource is initialized with original URL immediately, so this should always have a value
      const baseSource = videoSource || { uri: slide.background }
      const isVideoReady = videoLoaded || videoIsCached
      
      // Configure streaming - start playback after loading small buffer
      // For cached videos, use minimal buffering for instant playback
      // For streaming videos, use normal buffering
      // Note: source object is recreated, but Video has stable key, so it won't re-initialize
      const source = {
        ...baseSource,
        bufferConfig: videoIsCached ? {
          // Cached video - minimal buffering for instant playback
          minBufferMs: 1000,      // Keep at least 1 second buffered
          maxBufferMs: 5000,      // Maximum buffer size (5 seconds)
          bufferForPlaybackMs: 500,  // Need 0.5 seconds to start playback
          bufferForPlaybackAfterRebufferMs: 1000,  // Need 1 second after rebuffering
        } : {
          // Streaming video - optimized buffering for faster start
          // react-native-video has built-in cache, so subsequent plays should be faster
          minBufferMs: 3000,      // Keep at least 3 seconds buffered (reduced from 5)
          maxBufferMs: 15000,     // Maximum buffer size (15 seconds, reduced from 20)
          bufferForPlaybackMs: 1000,  // Need 1 second to start playback (reduced from 2)
          bufferForPlaybackAfterRebufferMs: 3000,  // Need 3 seconds after rebuffering (reduced from 5)
        }
      }
      
      // Use videoResizeMode which is calculated from ref (doesn't cause re-renders)
      // But for now, use fixed "contain" to prevent any jumps
      const fixedResizeMode = "contain"
      
      if (__DEV__) {
        const aspectRatioFromRef = videoAspectRatioRef.current
        console.log(`[StorySlide] Rendering video in backgroundElement - slide: ${slide?.id}, resizeMode: ${fixedResizeMode}, aspectRatio(ref): ${aspectRatioFromRef}, isVideoReady: ${isVideoReady}, videoOpacityReady: ${videoOpacityReady}`)
      }
      
      // Use videoOpacityReady instead of isVideoReady for opacity
      // This adds 50ms delay after onReadyForDisplay to allow video to stabilize
      const containerOpacity = videoOpacityReady ? 1 : 0
      
      return (
        <View 
          style={[
            styles.slideVideoContainer,
            { opacity: containerOpacity } // Use opacity on container with delay
          ]} 
          pointerEvents="box-none"
        >
          <Video
            key={`video-${slide?.id}-${slide?.background}`} // Stable key prevents re-creation on state changes
            source={source}
            style={StyleSheet.absoluteFill}
            resizeMode={fixedResizeMode}
            paused={!isActive || !isVideoReady}
            muted={muted}
            repeat={false}
            onLoad={(data) => {
              if (__DEV__) {
                console.log(`[StorySlide] Video onLoad callback fired for slide ${slide?.id}`)
              }
              handleVideoLoad(data)
            }}
            onReadyForDisplay={() => {
              if (__DEV__) {
                console.log(`[StorySlide] Video onReadyForDisplay callback fired for slide ${slide?.id}`)
              }
              handleVideoReadyForDisplay()
            }}
            onError={handleVideoError}
            onEnd={handleVideoEnd}
            onProgress={handleVideoProgress}
            // Enable progressive download for faster start
            progressUpdateInterval={250}
            // Enable built-in cache for faster subsequent plays
            cache={true}
            // Optimize for faster start
            ignoreSilentSwitch="ignore"
            // Prevent black shutter view on Android before video is ready
            shutterColor="transparent"
            // Use fixed resizeMode="contain" - never changes, prevents jumps
            // Video is always rendered, but container opacity controls visibility
          />
        </View>
      )
    } else {
      // Image slide or video fallback
      return (
        <Image
          source={{ uri: slide.background }}
          style={[
            styles.slideImage,
            { opacity: imageLoaded ? 1 : 0 }
          ]}
          resizeMode="contain"
          onLoad={handleImageLoad}
          onLoadEnd={handleImageLoadEnd}
          onError={handleImageError}
          // Force reload to ensure onLoad fires
          key={slide.background}
        />
      )
    }
    // IMPORTANT: Do NOT include videoAspectRatio or videoResizeMode in dependencies
    // This prevents backgroundElement from recalculating when aspectRatio changes
    // Note: videoLoaded and videoIsCached are included but Video has stable key, so it won't re-create
    // The key ensures Video component persists across state changes, preventing jumps
    // source is memoized inside, so it won't cause re-renders
    // videoOpacityReady is used for opacity but not in dependencies to prevent unnecessary recalculations
  }, [slide?.background, slide?.id, slide?.type, videoLoaded, imageLoaded, isActive, muted, videoSource, videoIsCached, videoOpacityReady, handleVideoLoad, handleVideoReadyForDisplay, handleVideoError, handleVideoEnd, handleVideoProgress, handleImageLoad, handleImageLoadEnd, handleImageError])

  // Memoize background color to avoid recalculation on every render
  // Match iOS SDK: slide.backgroundColor or slide.background_color -> black fallback
  const backgroundColor = useMemo(() => {
    // Support both camelCase and snake_case (API might return background_color)
    const bgColor = slide?.backgroundColor || slide?.background_color

    if (bgColor && typeof bgColor === 'string' && bgColor.trim() !== '') {
      try {
        const rgb = hexToRgb(bgColor)
        // hexToRgb returns values 0-1, need to multiply by 255 for rgba
        return `rgba(${Math.round(rgb.red * 255)}, ${Math.round(rgb.green * 255)}, ${Math.round(rgb.blue * 255)}, 1)`
      } catch (error) {
        console.warn('[StorySlide] Error parsing background color:', error, bgColor)
        return '#000000'
      }
    }
    // iOS SDK fallback: black
    return '#000000'
  }, [slide?.backgroundColor, slide?.background_color])

  const isMediaReady = slide?.type === 'video' ? videoLoaded : imageLoaded

  // Log when component renders to track re-renders
  if (__DEV__) {
    const aspectRatioFromRef = videoAspectRatioRef.current
    console.log(`[StorySlide] Component render - slide: ${slide?.id}, resizeMode: ${videoResizeMode}, aspectRatio(ref): ${aspectRatioFromRef}, isMediaReady: ${isMediaReady}`)
  }

  return (
    <View style={[styles.slideContainer, style, { backgroundColor }]}>
      {/* Media content - always render but hide until loaded */}
      {slide && backgroundElement}
      
      {/* Loading indicator - show on top while loading, with solid background */}
      {mediaLoading && (
        <View style={styles.mediaLoadingContainer} pointerEvents="box-none">
          <View style={styles.mediaLoadingBackground} />
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
      
      {/* Volume button - only for video slides */}
      {slide?.type === 'video' && isMediaReady && (
        <Pressable
          style={styles.volumeButton}
          onPress={handleToggleMute}
        >
          <MaterialIcons
            name={muted ? 'volume-off' : 'volume-up'}
            size={18}
            color={DEFAULT_COLORS.closeButton}
          />
        </Pressable>
      )}
      
      {/* Interactive elements overlay - only show when media is loaded */}
      {isMediaReady && slide?.elements && slide.elements.length > 0 && (
        <StoryElements
          elements={slide.elements}
          onElementPress={onElementPress}
          settings={settings}
          slide={slide}
        />
      )}
    </View>
  )
}

// Memoize component to prevent unnecessary re-renders when only progress updates
export default React.memo(StorySlide, (prevProps, nextProps) => {
  // Only re-render if these props actually changed
  return (
    prevProps.slide?.id === nextProps.slide?.id &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.slide?.background === nextProps.slide?.background &&
    prevProps.slide?.backgroundColor === nextProps.slide?.backgroundColor &&
    prevProps.slide?.elements?.length === nextProps.slide?.elements?.length
  )
})
