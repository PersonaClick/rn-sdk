import { createToastController, TOAST_DURATION } from '../components/design-system/ToastPresenter'

// The toast presenter's timing, without rendering: what is on screen and when it goes.

function setup() {
  const onChange = jest.fn()
  const onHide = jest.fn()
  const controller = createToastController({ onChange, onHide })
  const last = () => onChange.mock.calls[onChange.mock.calls.length - 1][0]
  return { controller, onChange, onHide, last }
}

describe('Toast presenter', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  test('shows at the bottom for 2000 ms by default, then hides and calls onHide', () => {
    const { controller, onHide, last } = setup()

    controller.show('Copied')
    expect(last()).toMatchObject({ text: 'Copied', position: 'bottom', visible: true })

    jest.advanceTimersByTime(TOAST_DURATION - 1)
    expect(onHide).not.toHaveBeenCalled()
    expect(last().visible).toBe(true)

    jest.advanceTimersByTime(1)
    expect(onHide).toHaveBeenCalledTimes(1)
    // The text stays through the fade-out.
    expect(last()).toMatchObject({ text: 'Copied', visible: false })
  })

  test('takes position and duration', () => {
    const { controller, onHide, last } = setup()

    controller.show('Code copied to clipboard', 'top', 500)
    expect(last()).toMatchObject({ position: 'top', visible: true })

    jest.advanceTimersByTime(500)
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  test('a new show replaces the toast on screen and restarts the timer', () => {
    const { controller, onHide, last } = setup()

    controller.show('First')
    const first = last().id
    jest.advanceTimersByTime(1500)

    controller.show('Second', 'top')
    expect(last()).toMatchObject({ text: 'Second', position: 'top', visible: true })
    expect(last().id).not.toBe(first)

    // The first toast's timer would have fired here; the replacement keeps it on screen.
    jest.advanceTimersByTime(1500)
    expect(onHide).not.toHaveBeenCalled()

    jest.advanceTimersByTime(500)
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  test('the same text shown again is a new toast with a fresh timer', () => {
    const { controller, onHide, last } = setup()

    controller.show('Copied')
    const first = last().id
    jest.advanceTimersByTime(1900)
    controller.show('Copied')
    expect(last().id).not.toBe(first)

    jest.advanceTimersByTime(1900)
    expect(onHide).not.toHaveBeenCalled()
    jest.advanceTimersByTime(100)
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  test('hide() takes the toast down early, once', () => {
    const { controller, onHide, last } = setup()

    controller.show('Copied')
    controller.hide()
    expect(last().visible).toBe(false)
    expect(onHide).toHaveBeenCalledTimes(1)

    controller.hide()
    jest.advanceTimersByTime(TOAST_DURATION)
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  test('hide() with nothing on screen does nothing', () => {
    const { controller, onChange, onHide } = setup()
    controller.hide()
    expect(onChange).not.toHaveBeenCalled()
    expect(onHide).not.toHaveBeenCalled()
  })

  test('empty text is ignored', () => {
    const { controller, onChange } = setup()
    controller.show('')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('an unusable duration falls back to the default', () => {
    const { controller, onHide } = setup()
    controller.show('Copied', 'bottom', -5)
    jest.advanceTimersByTime(TOAST_DURATION - 1)
    expect(onHide).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  test('dispose() cancels the pending hide', () => {
    const { controller, onHide } = setup()
    controller.show('Copied')
    controller.dispose()
    jest.advanceTimersByTime(TOAST_DURATION * 2)
    expect(onHide).not.toHaveBeenCalled()
  })
})
