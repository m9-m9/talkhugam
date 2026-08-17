import type { ReactNode } from 'react'

import { Field } from '@seed-design/react'

type FormFieldProps = {
  children: ReactNode
  description?: string | undefined
  errorMessage?: string | undefined
  label: string
  name: string
  optional?: boolean
}

/** 폼 레이블과 오류 설명을 SEED 접근성 컨텍스트로 입력 요소에 연결한다. */
export function FormField({
  children,
  description,
  errorMessage,
  label,
  name,
  optional = false,
}: FormFieldProps) {
  return (
    <Field.Root invalid={Boolean(errorMessage)} name={name}>
      <Field.Header>
        <Field.Label className="talkhugam-form-field-label" weight="medium">
          {label}
          {optional ? <Field.IndicatorText aria-hidden="true">선택</Field.IndicatorText> : null}
        </Field.Label>
      </Field.Header>
      {children}
      {description || errorMessage ? (
        <Field.Footer>
          {errorMessage ? <Field.ErrorMessage>{errorMessage}</Field.ErrorMessage> : null}
          {description ? <Field.Description>{description}</Field.Description> : null}
        </Field.Footer>
      ) : null}
    </Field.Root>
  )
}
