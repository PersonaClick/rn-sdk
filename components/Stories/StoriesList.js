import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo, useRef } from 'react'
import {
  View,
  FlatList,
  Image,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Platform,
  AppState,
} from 'react-native'
import { styles, DEFAULT_CONFIG, DEFAULT_COLORS, hexToRgba, getColorFromSettings } from './styles'
import { isStoryFullyViewed } from '../../lib/stories/storage'
import { awaitInstance } from '../../lib/facade/facade'
import { preloadSlides, cancelAllPreloads, pausePreloading, resumePreloading } from '../../lib/stories/slidePreloader'
import StoryViewer from './StoryViewer'

/**
 * StoriesList Component
 * Horizontal scrollable list of story circles
 * 
 * By default the list opens the full-screen story viewer itself when a circle is tapped, so a
 * host only needs to render <StoriesList sdk code />. Set `showViewer={false}` to manage a
 * StoryViewer yourself (use `onStoryPress` for that).
 *
 * @param {Object} props
 * @param {Object} [props.sdk] - SDK instance. Optional if `shopId` is given.
 * @param {string} [props.shopId] - Resolve the SDK by shop id through the registry (Release 3).
 *   Ignored when an explicit `sdk` prop is passed. Use one or the other.
 * @param {string} props.code - Stories code identifier
 * @param {boolean} [props.showViewer=true] - Open the built-in StoryViewer on tap
 * @param {Function} [props.onElementPress] - Forwarded to the built-in StoryViewer (tap on a slide element)
 * @param {Function} [props.onStoryPress] - Called when a story circle is pressed (story, index, settings)
 * @param {Object} [props.style] - Additional styles for FlatList
 * @param {Object} [props.contentContainerStyle] - Additional styles for FlatList content container
 * @param {number} [props.iconSize] - Size of story circles
 * @param {number} [props.iconMargin] - Margin between story circles
 * @param {number} [props.height] - Height of the stories container
 * @param {Function} [props.onLoadComplete] - Callback when stories load
 */
const StoriesList = forwardRef(function StoriesList({
  sdk: sdkProp,
  shopId,
  code,
  showViewer = true,
  onElementPress,
  onStoryPress,
  style,
  contentContainerStyle,
  iconSize = DEFAULT_CONFIG.iconSize,
  iconMargin = DEFAULT_CONFIG.iconMargin,
  height = DEFAULT_CONFIG.storyHeight,
  onLoadComplete
}, ref) {
  // Resolve the SDK: an explicit `sdk` prop wins; otherwise resolve by `shopId` through the registry
  // (Release 3), reacting to a later registration. Keeps the `sdk` prop working.
  const [resolvedSdk, setResolvedSdk] = useState(sdkProp ?? null)
  useEffect(() => {
    if (sdkProp) {
      setResolvedSdk(sdkProp)
      return
    }
    if (!shopId) return
    const cancel = awaitInstance(shopId, (instance) => setResolvedSdk(instance))
    return cancel
  }, [sdkProp, shopId])
  const sdk = sdkProp ?? resolvedSdk

  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewedStates, setViewedStates] = useState({})
  const [settings, setSettings] = useState(null)
  const [viewerVisible, setViewerVisible] = useState(false)
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0)
  const preloadTimeoutRef = useRef(null)
  const appStateSubscriptionRef = useRef(null)

  // Function to refresh viewed states
  const refreshViewedStates = useCallback(async () => {
    if (!stories || stories.length === 0) return
    
    try {
      if (__DEV__) {
      }
      const viewedStatesMap = {}
      for (const story of stories) {
        const slideIds = story.slides.map(slide => slide.id)
        const isViewed = await isStoryFullyViewed(story.id, slideIds, sdk?.shop_id)
        viewedStatesMap[story.id] = isViewed
        if (__DEV__) {
        }
      }
      setViewedStates(viewedStatesMap)
      if (__DEV__) {
      }
    } catch (err) {
      console.warn('[StoriesList] Error refreshing viewed states:', err)
    }
  }, [stories, sdk])

  // Expose refreshViewedStates via ref
  useImperativeHandle(ref, () => ({
    refreshViewedStates,
  }))

  const handleStoryPress = useCallback((story, index) => {
    onStoryPress?.(story, index, settings)
    if (showViewer) {
      setSelectedStoryIndex(index)
      setViewerVisible(true)
    }
  }, [onStoryPress, settings, showViewer])

  const handleViewerClose = useCallback(() => {
    setViewerVisible(false)
    // Viewed-slide writes settle shortly after the viewer closes; refresh the ring states then.
    setTimeout(() => {
      refreshViewedStates()
    }, 300)
  }, [refreshViewedStates])

  useEffect(() => {
    loadStories()
  }, [sdk, code])

  // Setup AppState listener for pause/resume preloading
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        pausePreloading()
      } else if (nextAppState === 'active') {
        resumePreloading()
      }
    }

    appStateSubscriptionRef.current = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      if (appStateSubscriptionRef.current) {
        appStateSubscriptionRef.current.remove()
        appStateSubscriptionRef.current = null
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending preload timeout
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current)
        preloadTimeoutRef.current = null
      }
      
      // Cancel all preloads
      cancelAllPreloads()
    }
  }, [])

  const loadStories = async () => {
    if (!sdk || !code) {
      // Still resolving the SDK by shopId (Release 3): stay in loading instead of flashing an error.
      if (!sdk && shopId && !sdkProp) {
        setLoading(true)
        return
      }
      setError('SDK or code not provided')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const response = await sdk.getStories(code)
      
      if (response && response.stories) {
        setStories(response.stories)
        
        // Save settings for styling story titles
        if (response.settings) {
          setSettings(response.settings)
        }
        
        // Check viewed states for all stories
        const viewedStatesMap = {}
        for (const story of response.stories) {
          const slideIds = story.slides.map(slide => slide.id)
          const isViewed = await isStoryFullyViewed(story.id, slideIds, sdk?.shop_id)
          viewedStatesMap[story.id] = isViewed
        }
        setViewedStates(viewedStatesMap)
        
        // Start preloading slides in background (with delay to not block UI)
        // Use setTimeout with low priority to ensure it doesn't interfere with main app
        if (preloadTimeoutRef.current) {
          clearTimeout(preloadTimeoutRef.current)
        }
        preloadTimeoutRef.current = setTimeout(() => {
          if (__DEV__) {
            console.log('[StoriesList] Starting preload for all slides')
          }
          preloadSlides(response.stories, {
            currentStoryIndex: 0,
            currentSlideIndex: 0,
            preloadAll: true, // Preload all slides in background
          })
        }, 500) // 500ms delay to ensure UI is responsive
        
        onLoadComplete?.(true)
      } else {
        setError('Invalid response format')
        onLoadComplete?.(false)
      }
    } catch (err) {
      console.error('Error loading stories:', err)
      setError(err.message || 'Failed to load stories')
      onLoadComplete?.(false)
    } finally {
      setLoading(false)
    }
  }

  const renderStoryItem = ({ item: story, index }) => {
    const isViewed = viewedStates[story.id] || story.viewed
    
    // Get title color from settings or use default
    let titleColor = DEFAULT_COLORS.text
    if (settings?.color) {
      // Convert hex color to rgba format for React Native
      const rgba = hexToRgba(settings.color, 1)
      titleColor = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`
    }
    
    // Get font size from settings or use default
    const titleFontSize = settings?.fontSize || DEFAULT_CONFIG.fontSize
    
    // Get border colors from settings or use defaults (match iOS SDK)
    const borderColorViewed = getColorFromSettings(settings, 'borderViewed', DEFAULT_COLORS.borderViewed)
    const borderColorNotViewed = getColorFromSettings(settings, 'borderNotViewed', DEFAULT_COLORS.borderNotViewed)
    const backgroundPinColor = getColorFromSettings(settings, 'backgroundPin', DEFAULT_COLORS.backgroundPin)
    
    // Component for story name with word truncation
    // Rule: if a word is longer than 7 characters, truncate it to 7 characters with "..."
    // Remove standard truncation (numberOfLines, ellipsizeMode)
    const StoryNameText = ({ name, style }) => {
      const processText = (text) => {
        if (!text || typeof text !== 'string') return ''
        
        // Split text into words (preserve spaces)
        const words = text.split(/(\s+)/)
        
        // Process each word
        const processedWords = words.map(word => {
          // If it's a space, keep it as is
          if (/^\s+$/.test(word)) {
            return word
          }
          
          // If word is longer than 7 characters, truncate to 7 and add "..."
          if (word.length > 7) {
            return word.substring(0, 7) + '...'
          }
          
          // Otherwise, keep the word as is
          return word
        })
        
        return processedWords.join('')
      }
      
      const processedName = processText(name)
      
      return (
        <Text style={[{ flexShrink: 1 }, style]}>
          {processedName}
        </Text>
      )
    }
    
    return (
      <Pressable
        style={[styles.storyItem, { marginHorizontal: iconMargin }]}
        onPress={() => handleStoryPress(story, index)}
      >
        {/* Circle container - всегда сверху, фиксированная высота */}
        <View
          style={[
            styles.storyCircle,
            {
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize / 2,
              borderColor: isViewed ? borderColorViewed : borderColorNotViewed,
            },
          ]}
        >
          <Image
            source={{ uri: story.avatar }}
            style={[
              styles.storyAvatar,
              {
                width: iconSize - 8,
                height: iconSize - 8,
                borderRadius: (iconSize - 8) / 2,
              },
            ]}
            resizeMode="cover"
          />
          {/* Pin indicator - match iOS SDK */}
          {story.pinned && (
            <View 
              style={[
                styles.pinIndicator,
                { 
                  backgroundColor: backgroundPinColor,
                  bottom: 0,
                  right: iconSize < 80 ? 0 : 4,
                }
              ]}
            >
              <Text style={styles.pinSymbol}>
                {settings?.pinSymbol || '📌'}
              </Text>
            </View>
          )}
        </View>
        {/* Text container - центрирован под кружком */}
        <StoryNameText
          name={story.name}
          style={[
            styles.storyName,
            {
              fontSize: titleFontSize,
              color: titleColor,
            },
          ]}
        />
      </Pressable>
    )
  }

  const renderLoadingItem = ({ index }) => (
    <View style={[styles.storyItem, { marginHorizontal: iconMargin }]}>
      <View
        style={[
          styles.storyCircle,
          styles.storyPlaceholder,
          {
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize / 2,
          },
        ]}
      />
      <View
        style={[
          styles.storyPlaceholder,
          {
            width: DEFAULT_CONFIG.labelWidth,
            height: DEFAULT_CONFIG.fontSize,
            borderRadius: 2,
            marginTop: 4,
          },
        ]}
      />
    </View>
  )

  // Merge contentContainerStyle with default styles
  const mergedContentContainerStyle = [
    styles.storiesList,
    contentContainerStyle,
  ]

  if (loading) {
    return (
      <FlatList
        data={Array(4).fill(null)} // Show 4 placeholder items
        renderItem={renderLoadingItem}
        keyExtractor={(_, index) => `loading-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={mergedContentContainerStyle}
        style={[{ height }, style]}
      />
    )
  }

  if (error) {
    return null
  }

  if (stories.length === 0) {
    return null
  }

  return (
    <>
      <FlatList
        data={stories}
        renderItem={renderStoryItem}
        keyExtractor={(story) => story.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={mergedContentContainerStyle}
        style={[{ height }, style]}
      />
      {showViewer && (
        <StoryViewer
          visible={viewerVisible}
          stories={stories}
          initialStoryIndex={selectedStoryIndex}
          settings={settings}
          sdk={sdk}
          code={code}
          onClose={handleViewerClose}
          onElementPress={onElementPress}
        />
      )}
    </>
  )
})

export default StoriesList
