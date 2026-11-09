import React, { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  popupBirthdayMask,
  popupEmailProblem,
  popupProfileParams,
  popupSubscribeParams,
  popupValidateForm,
} from '../../lib/popupsV3/actions'
import { popupApplyRuntimeVariables } from '../../lib/popupsV3/markup'
import { popupColorWithOpacity } from '../../lib/popupsV3/values'
import Checkbox from '../design-system/Checkbox'
import { PopupV3ButtonFace } from './PopupV3Basic'
import PopupV3Text from './PopupV3Text'
import { popupFontFamily } from './popupV3Style'

/**
 * Формы попапа v3: подписка по email (emailCollector) и форма профиля (form). Проверка — до
 * отправки; ошибка сети — текст под формой, повтор той же кнопкой; двойная отправка заблокирована.
 */

const ERROR_COLOR = '#b91c1c'

/** Поле ввода в стиле дизайна (`emailInput*` / `formInput*`); в фокусе прокручивается в видимую часть. */
export function PopupV3Input({ input, family, style, reveal, ...rest }) {
  const ref = useRef(null)
  return (
    <TextInput
      ref={ref}
      onFocus={() => reveal && reveal(ref)}
      placeholderTextColor={popupColorWithOpacity(input.textColor, 0.45)}
      style={[
        styles.input,
        {
          backgroundColor: input.bgColor,
          color: input.textColor,
          borderColor: input.borderColor,
          borderRadius: input.radius,
          paddingVertical: input.paddingY,
          fontSize: input.fontSize,
        },
        family ? { fontFamily: family } : null,
        style,
      ]}
      {...rest}
    />
  )
}

/**
 * Цвета галочки согласия — из уже разобранных кнопки и поля формы: отмеченная залита фоном кнопки
 * с галкой цвета её текста, пустая — фоном поля с его рамкой. Попап рисуется по дизайну, поэтому
 * токены кита (они следуют тёмной схеме системы) здесь не участвуют.
 */
export const popupConsentColors = ({ button, input }) => ({
  checkedColor: button.bgColor,
  checkColor: button.textColor,
  uncheckedColor: input.bgColor,
  borderColor: input.borderColor,
})

/** Галочка согласия с подписью (разметка) в цветах формы. */
function Consent({ checked, onToggle, label, runtime, color, family, props }) {
  return (
    <Pressable onPress={onToggle} style={styles.consent} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Checkbox state={checked ? 'checked' : 'unchecked'} onChange={onToggle} {...popupConsentColors(props)} />
      <PopupV3Text text={label} runtime={runtime} style={[styles.consentText, { color }, family ? { fontFamily: family } : null]} />
    </Pressable>
  )
}

/** Экран успеха формы: заголовок и текст. */
function Success({ title, message, runtime, success, color }) {
  const box = success
    ? {
        backgroundColor: success.bgColor,
        borderRadius: success.radius,
        paddingHorizontal: success.paddingX,
        paddingVertical: success.paddingY,
      }
    : null
  const align = success ? success.align : 'center'
  return (
    <View style={box}>
      {title ? (
        <PopupV3Text
          text={title}
          runtime={runtime}
          style={[styles.successTitle, { textAlign: align, color: success ? success.titleColor : color, fontSize: success ? success.titleFontSize : 16 }]}
        />
      ) : null}
      {message ? (
        <PopupV3Text
          text={message}
          runtime={runtime}
          style={[styles.successBody, { textAlign: align, color: success ? success.textColor : color, fontSize: success ? success.fontSize : 13 }]}
        />
      ) : null}
    </View>
  )
}

/**
 * Подписка по email: поле, кнопка и согласие (обязательно). Успех — события `subscribe` (`email`) и
 * `submit`, экран успеха, если у него есть тексты.
 */
export function PopupV3EmailElement({ element, context }) {
  const { props, box } = element
  const { entry, runtime, texts } = context
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')
  const sending = useRef(false)
  const family = popupFontFamily(box.fontFamily)

  const submit = async () => {
    if (sending.current || status === 'done') return
    if (popupEmailProblem(email, consent)) {
      setError(popupApplyRuntimeVariables(props.errorMessage, runtime))
      return
    }
    sending.current = true
    setError('')
    setStatus('sending')
    try {
      await entry.actions.subscribeEmail({ email: email.trim(), consentFields: props.consentFields, segmentId: props.segmentId })
      entry.event('subscribe', 'email')
      entry.event('submit')
      entry.contextChanged('subscription', 'manage', popupSubscribeParams(email, props.consentFields))
      setStatus('done')
    } catch (failure) {
      entry.log(`subscription failed: ${(failure && failure.message) || failure}`)
      setError(texts.sendError)
      setStatus('idle')
    } finally {
      sending.current = false
    }
  }

  if (status === 'done' && (props.successTitle || props.successMessage)) {
    return <Success title={props.successTitle} message={props.successMessage} runtime={runtime} success={props.success} />
  }
  const inline = props.layout === 'inline'
  return (
    <View style={styles.form}>
      <View style={inline ? styles.inlineRow : styles.column}>
        <PopupV3Input
          input={props.input}
          family={family}
          reveal={context.reveal}
          style={inline ? styles.inlineInput : null}
          value={email}
          onChangeText={setEmail}
          placeholder={popupApplyRuntimeVariables(props.placeholder, runtime)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={submit}
          editable={status !== 'done'}
        />
        <PopupV3ButtonFace button={props.button} text={props.submitText} runtime={runtime} onPress={submit} disabled={status !== 'idle'} />
      </View>
      <Consent checked={consent} onToggle={() => setConsent((value) => !value)} label={props.consentLabel} runtime={runtime} color={box.textColor} family={family} props={props} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const KEYBOARDS = { email: 'email-address', phone: 'phone-pad', date: 'number-pad' }

/** Поле формы по виду: email, телефон, текст, дата (маска ДД.ММ.ГГГГ) или выбор пола. */
function FormField({ field, value, onChange, props, texts, runtime, color, family, problem, reveal }) {
  const label = field.label ? `${field.label}${field.required ? ' *' : ''}` : ''
  let control
  if (field.input === 'select') {
    control = (
      <View style={styles.genderRow}>
        {[
          ['m', texts.genderMale],
          ['f', texts.genderFemale],
        ].map(([code, title]) => {
          const selected = value === code
          return (
            <Pressable
              key={code}
              onPress={() => onChange(selected ? '' : code)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.genderOption,
                {
                  borderRadius: props.input.radius,
                  borderColor: selected ? props.button.bgColor : props.input.borderColor,
                  backgroundColor: selected ? props.button.bgColor : props.input.bgColor,
                  paddingVertical: props.input.paddingY,
                },
              ]}
            >
              <Text style={{ color: selected ? props.button.textColor : props.input.textColor, fontSize: props.input.fontSize }}>{title}</Text>
            </Pressable>
          )
        })}
      </View>
    )
  } else {
    const date = field.input === 'date'
    control = (
      <PopupV3Input
        input={props.input}
        family={family}
        reveal={reveal}
        value={value}
        onChangeText={(text) => onChange(date ? popupBirthdayMask(text) : text)}
        placeholder={popupApplyRuntimeVariables(field.placeholder, runtime) || (date ? texts.birthdayPlaceholder : undefined)}
        keyboardType={KEYBOARDS[field.input] || 'default'}
        autoCapitalize={field.input === 'email' ? 'none' : 'sentences'}
        autoCorrect={field.input === 'text'}
        maxLength={date ? 10 : undefined}
      />
    )
  }
  return (
    <View style={styles.field}>
      {label ? <PopupV3Text text={label} runtime={runtime} style={[styles.fieldLabel, { color }, family ? { fontFamily: family } : null]} /> : null}
      <View style={problem ? styles.problem : null}>{control}</View>
    </View>
  )
}

/**
 * Форма профиля: до 8 полей, согласие, кнопка. Успех — событие `submit` и экран успеха, если у него
 * есть тексты.
 */
export function PopupV3FormElement({ element, context }) {
  const { props, box } = element
  const { entry, runtime, texts } = context
  const [values, setValues] = useState({})
  const [consent, setConsent] = useState(false)
  const [problems, setProblems] = useState({})
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')
  const sending = useRef(false)
  const family = popupFontFamily(box.fontFamily)

  const submit = async () => {
    if (sending.current || status === 'done') return
    const check = popupValidateForm(props.fields, values)
    setProblems(check.problems)
    if (!check.ok) {
      setError(popupApplyRuntimeVariables(props.errorMessage, runtime))
      return
    }
    sending.current = true
    setError('')
    setStatus('sending')
    try {
      await entry.actions.submitForm({ fields: props.fields, values, consent, consentFields: props.consentFields, segmentId: props.segmentId })
      entry.event('submit')
      entry.contextChanged('profile', 'set', popupProfileParams(props.fields, values))
      setStatus('done')
    } catch (failure) {
      entry.log(`form failed: ${(failure && failure.message) || failure}`)
      setError(texts.sendError)
      setStatus('idle')
    } finally {
      sending.current = false
    }
  }

  if (status === 'done' && (props.successTitle || props.successMessage)) {
    return <Success title={props.successTitle} message={props.successMessage} runtime={runtime} color={box.textColor} />
  }
  return (
    <View style={styles.form}>
      {props.fields.map((field) => (
        <FormField
          key={field.id}
          field={field}
          value={values[field.id] || ''}
          onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))}
          props={props}
          texts={texts}
          runtime={runtime}
          color={box.textColor}
          family={family}
          problem={!!problems[field.id]}
          reveal={context.reveal}
        />
      ))}
      {props.consentLabel ? (
        <Consent checked={consent} onToggle={() => setConsent((value) => !value)} label={props.consentLabel} runtime={runtime} color={box.textColor} family={family} props={props} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PopupV3ButtonFace button={props.button} text={props.submitText} runtime={runtime} onPress={submit} disabled={status !== 'idle'} />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  column: { gap: 8 },
  inlineRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  inlineInput: { flex: 1, minWidth: 0 },
  input: { borderWidth: 1, paddingHorizontal: 12, margin: 0 },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  consentText: { flex: 1, fontSize: 11, lineHeight: 15 },
  error: { color: ERROR_COLOR, fontSize: 12, lineHeight: 16 },
  successTitle: { fontWeight: '600' },
  successBody: { marginTop: 6 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 11 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderOption: { flex: 1, borderWidth: 1, alignItems: 'center', paddingHorizontal: 12 },
  problem: { borderRadius: 10, borderWidth: 1, borderColor: ERROR_COLOR },
})
