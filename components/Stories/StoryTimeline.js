// FILE VERSION: 2024-12-19-FIX-PROGRESS-BAR-V2
// Note: All progress bars have equal width (fillEqually like iOS) - duration affects fill speed via progress prop, not bar width

import React, { useRef, useState, useEffect, useMemo } from 'react'
import { View, StyleSheet, Dimensions, Animated, Platform } from 'react-native'
import { DEFAULT_COLORS, DEFAULT_CONFIG } from './styles'

const { width: screenWidth } = Dimensions.get('window')

/**
 * StoryTimeline Component
 * Timeline with progress bars for all slides, similar to UIStackView with UIProgressView in iOS SDK
 * All progress bars have equal width (fillEqually distribution) - duration affects fill speed via progress prop
 * 
 * @param {Object} props
 * @param {Array} props.slides - Array of slide objects
 * @param {number} props.currentSlideIndex - Index of currently active slide
 * @param {number} props.currentProgress - Progress of current slide (0-1), speed depends on slide duration
 * @param {string} props.backgroundColor - Background color for progress bars
 */
export default function StoryTimeline({
  slides = [],
  currentSlideIndex = 0,
  currentProgress = 0,
  backgroundColor = DEFAULT_COLORS.backgroundProgress,
}) {
  const wrapperRef = useRef(null)
  const [wrapperWidth, setWrapperWidth] = useState(0)
  // Store Animated.Value for each slide's fill width
  const animatedWidthsRef = useRef({})

  // Calculate bar width in pixels (like iOS UIStackView with fillEqually distribution)
  // All bars have equal width - duration affects fill speed, not bar width
  const calculateBarWidth = (wrapperWidth, slidesCount) => {
    if (slidesCount === 0 || wrapperWidth === 0) return 0
    const marginBetweenBars = DEFAULT_CONFIG.progressBarMargin * 2 // marginHorizontal * 2 for each bar
    const totalMargin = (slidesCount - 1) * marginBetweenBars
    return (wrapperWidth - totalMargin) / slidesCount
  }
  
  // Calculate actual bar width - use state value or fallback
  const effectiveWidth = wrapperWidth > 0 ? wrapperWidth : (screenWidth - 32 - 12 - 30) // progressContainer padding + closeButton
  const actualBarWidth = calculateBarWidth(effectiveWidth, slides.length)
  
  // Clamp progress between 0 and 1
  const clampedProgress = Math.max(0, Math.min(1, currentProgress))

  // Initialize animated values for slides - ensure they start at 0
  useEffect(() => {
    slides.forEach((slide, index) => {
      const slideKey = slide.id || index
      if (!animatedWidthsRef.current[slideKey]) {
        animatedWidthsRef.current[slideKey] = new Animated.Value(0)
      } else {
        // CRITICAL: Reset to 0 if it's not the current slide OR if it's the current slide but progress is 0
        // This ensures slides start at 0 when they become current
        if (index !== currentSlideIndex) {
          const currentValue = animatedWidthsRef.current[slideKey]._value || 0
          if (currentValue > 0) {
            animatedWidthsRef.current[slideKey].setValue(0)
          }
        } else if (index === currentSlideIndex && currentProgress === 0) {
          // CRITICAL: If this is the current slide and progress is 0, ensure animated value is also 0
          const currentValue = animatedWidthsRef.current[slideKey]._value || 0
          if (currentValue > 0) {
            animatedWidthsRef.current[slideKey].setValue(0)
          }
        }
      }
    })
  }, [slides, currentSlideIndex, currentProgress])

  // Reset animated value when slide changes and animate current slide
  const prevSlideIndexRef = useRef(-1) // Initialize to -1 to detect first slide change
  const prevProgressRef = useRef(currentProgress)
  
  // CRITICAL: Use useMemo to ensure actualBarWidth and clampedProgress are stable
  const memoizedActualBarWidth = useMemo(() => actualBarWidth, [actualBarWidth])
  const memoizedClampedProgress = useMemo(() => clampedProgress, [clampedProgress])
  
  // CRITICAL: Separate effect to reset animated value when slide changes
  useEffect(() => {
    if (currentSlideIndex >= 0 && currentSlideIndex < slides.length) {
      const slide = slides[currentSlideIndex]
      const slideKey = slide.id || currentSlideIndex
      
      // Ensure animated value exists
      if (!animatedWidthsRef.current[slideKey]) {
        animatedWidthsRef.current[slideKey] = new Animated.Value(0)
      }
      
      // CRITICAL: If slide changed, reset to 0 IMMEDIATELY
      if (prevSlideIndexRef.current !== currentSlideIndex) {
        const animatedValue = animatedWidthsRef.current[slideKey]
        if (animatedValue) {
          animatedValue.stopAnimation()
          animatedValue.setValue(0)
        }
        
        // Reset previous slide
        if (prevSlideIndexRef.current >= 0 && prevSlideIndexRef.current < slides.length) {
          const prevSlide = slides[prevSlideIndexRef.current]
          const prevSlideKey = prevSlide.id || prevSlideIndexRef.current
          const prevAnimatedValue = animatedWidthsRef.current[prevSlideKey]
          if (prevAnimatedValue) {
            prevAnimatedValue.stopAnimation()
            prevAnimatedValue.setValue(0)
          }
        }
        
        prevSlideIndexRef.current = currentSlideIndex
      }
    }
  }, [currentSlideIndex, slides.length])
  
  useEffect(() => {
    // Ensure we have valid slide index
    if (currentSlideIndex < 0 || currentSlideIndex >= slides.length) {
      return
    }
    
    const slide = slides[currentSlideIndex]
    const slideKey = slide.id || currentSlideIndex
    
    // Ensure animated value exists and is initialized to 0
    if (!animatedWidthsRef.current[slideKey]) {
      animatedWidthsRef.current[slideKey] = new Animated.Value(0)
    }
    
    const animatedValue = animatedWidthsRef.current[slideKey]
    
    // CRITICAL: If slide changed, reset to 0 FIRST before any animation
    if (prevSlideIndexRef.current !== currentSlideIndex) {
      // Stop any ongoing animations
      animatedValue.stopAnimation()
      animatedValue.removeAllListeners()
      
      // Reset previous slide's animated value to 0
      if (prevSlideIndexRef.current >= 0 && prevSlideIndexRef.current < slides.length) {
        const prevSlide = slides[prevSlideIndexRef.current]
        const prevSlideKey = prevSlide.id || prevSlideIndexRef.current
        const prevAnimatedValue = animatedWidthsRef.current[prevSlideKey]
        if (prevAnimatedValue) {
          prevAnimatedValue.stopAnimation()
          prevAnimatedValue.setValue(0)
        }
      }
      
      // CRITICAL: Reset current slide to 0 when switching - this ensures it starts from 0
      animatedValue.setValue(0)
      
      prevSlideIndexRef.current = currentSlideIndex
      prevProgressRef.current = 0
    }
    
    // Only animate if we have valid dimensions
    if (memoizedActualBarWidth > 0 && wrapperWidth > 0) {
      // Calculate target width based on progress
      const targetWidth = Math.max(0, memoizedActualBarWidth * memoizedClampedProgress)
      const currentWidth = animatedValue._value || 0
      
      // Always update if width changed (even by 0.1px) or progress changed
      const progressChanged = Math.abs(prevProgressRef.current - currentProgress) > 0.001
      const widthChanged = Math.abs(targetWidth - currentWidth) > 0.1
      
      if (widthChanged || progressChanged) {
        // Stop any ongoing animation and remove old listeners
        animatedValue.stopAnimation()
        animatedValue.removeAllListeners()
        
        Animated.timing(animatedValue, {
          toValue: targetWidth,
          duration: 50, // Fast animation for smooth progress
          useNativeDriver: false, // width animation requires JS driver
        }).start()
        
        prevProgressRef.current = currentProgress
      }
    }
  }, [currentProgress, currentSlideIndex, memoizedActualBarWidth, memoizedClampedProgress, wrapperWidth, slides.length])


  // Get wrapper width from layout - use state to trigger re-render
  const handleLayout = (event) => {
    const { width } = event.nativeEvent.layout
    if (width > 0 && width !== wrapperWidth) {
      setWrapperWidth(width)
    }
  }

  return (
    <View 
      ref={wrapperRef}
      style={styles.timelineWrapper}
      onLayout={handleLayout}
    >
      {slides.map((slide, index) => {
        // Determine progress value for each bar (like iOS: 0, 1, or current progress)
        let progressValue = 0
        if (index < currentSlideIndex) {
          progressValue = 1 // Viewed slides - 100% (like iOS UIProgressView.progress = 1)
        } else if (index === currentSlideIndex) {
          progressValue = clampedProgress // Current slide - actual progress (0-1)
        } else {
          progressValue = 0 // Future slides - 0% (like iOS UIProgressView.progress = 0)
        }

        const isCurrentSlide = index === currentSlideIndex
        
        // CRITICAL: Calculate fill width - this MUST be correct
        // All bars have equal width (fillEqually like iOS) - duration affects fill speed, not bar width
        let fillWidth = 0
        if (actualBarWidth > 0 && wrapperWidth > 0) {
          if (isCurrentSlide) {
            // For current slide: calculate based on progressValue
            if (progressValue > 0) {
              const rawWidth = actualBarWidth * progressValue
              fillWidth = Math.max(1, Math.round(rawWidth)) // At least 1px when progress > 0
            } else {
              fillWidth = 0 // 0 when progress = 0
            }
          } else {
            // For other slides: use progressValue directly
            fillWidth = Math.max(0, Math.round(actualBarWidth * progressValue))
          }
        }
        
        const slideKey = slide.id || index
        
        // Background color: white with transparency for all slides (inactive and active)
        // Always use white with transparency from DEFAULT_COLORS, ignore passed backgroundColor parameter
        const barBgColor = DEFAULT_COLORS.backgroundProgress // White with transparency for all slides

        // Always render fill for current slide to ensure it updates
        // For other slides, only render if progress > 0
        const shouldRenderFill = fillWidth > 0 || isCurrentSlide

        const barWidth = actualBarWidth > 0 ? actualBarWidth : 0
        
        // CRITICAL: Force white with transparency background color for all slides
        const finalBgColor = 'rgba(255, 255, 255, 0.3)'
        
        const progressBarElement = (
          <View
            key={`timeline-bar-${slideKey}`}
            style={[
              styles.progressBar,
              { 
                width: barWidth,
                borderWidth: 0,
                borderColor: 'transparent',
              },
              // CRITICAL: Set backgroundColor in separate object to ensure it overrides style from StyleSheet
              // Force white with transparency for all slides
              {
                backgroundColor: finalBgColor,
              }
            ]}
            // Add debug prop to verify style is applied
            testID={`progress-bar-${index}-${isCurrentSlide ? 'current' : 'inactive'}`}
          >
            {/* Render fill for current slide using Animated.View for smooth width animation */}
            {isCurrentSlide && (() => {
              // CRITICAL: Create animated value synchronously if it doesn't exist
              if (!animatedWidthsRef.current[slideKey]) {
                animatedWidthsRef.current[slideKey] = new Animated.Value(0)
              }
              
              const animatedValue = animatedWidthsRef.current[slideKey]
              
              // CRITICAL: If progress is 0, force reset animated value to 0
              const currentAnimatedValue = animatedValue._value || 0
              if (progressValue === 0 && clampedProgress === 0 && currentAnimatedValue > 0) {
                animatedValue.setValue(0)
              }
              
              return (
                <Animated.View
                  key={`timeline-fill-current-${slideKey}-${currentSlideIndex}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: animatedValue,
                    minWidth: 0, // Allow width to be 0
                    height: DEFAULT_CONFIG.progressBarHeight,
                    backgroundColor: '#FFFFFF', // White fill
                    borderRadius: DEFAULT_CONFIG.progressBarHeight / 2,
                    zIndex: 999,
                    overflow: 'hidden',
                  }}
                />
              )
            })()}
            {/* Render fill for completed slides */}
            {!isCurrentSlide && fillWidth > 0 && actualBarWidth > 0 && (
              <View
                key={`timeline-fill-complete-${slideKey}`}
                style={[
                  styles.progressFill,
                  {
                    width: fillWidth,
                    backgroundColor: DEFAULT_COLORS.text,
                    zIndex: 5,
                  }
                ]}
              />
            )}
          </View>
        )
        
        return progressBarElement
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  timelineWrapper: {
    flex: 1,
    flexDirection: 'row',
    marginRight: 12,
  },
  progressBar: {
    height: DEFAULT_CONFIG.progressBarHeight,
    borderRadius: DEFAULT_CONFIG.progressBarHeight / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // White with transparency - will be overridden by inline style if needed
    marginHorizontal: DEFAULT_CONFIG.progressBarMargin,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: DEFAULT_COLORS.text, // White fill
    borderRadius: DEFAULT_CONFIG.progressBarHeight / 2,
    minWidth: 0, // Allow width to be 0, but ensure it updates
    zIndex: 1, // Ensure fill is above background
    // Add border to make fill more visible for debugging
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
})
