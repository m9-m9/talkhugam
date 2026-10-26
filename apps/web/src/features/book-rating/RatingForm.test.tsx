import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RatingForm } from './RatingForm'

const bookChatId = '11111111-1111-4111-8111-111111111111'

afterEach(cleanup)

describe('RatingForm', () => {
  it('keeps saving disabled until a rating is chosen and sends the trimmed review', () => {
    const onSave = vi.fn()
    render(
      <RatingForm
        bookChatId={bookChatId}
        initialRating={null}
        initialReview={null}
        isSaving={false}
        onCancel={vi.fn()}
        onSave={onSave}
        submitLabel="별점 저장"
      />,
    )

    expect(screen.getByRole('button', { name: '별점 저장' })).toBeDisabled()
    expect(screen.getAllByRole('group')).toHaveLength(1)
    expect(screen.getByRole('group', { name: '별점' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '4점' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  좋아요  ' } })
    fireEvent.click(screen.getByRole('button', { name: '별점 저장' }))

    expect(onSave).toHaveBeenCalledWith({ bookChatId, rating: 4, review: '좋아요' })
  })

  it('sends null when the review is only whitespace', () => {
    const onSave = vi.fn()
    render(
      <RatingForm
        bookChatId={bookChatId}
        initialRating={5}
        initialReview="   "
        isSaving={false}
        onCancel={vi.fn()}
        onSave={onSave}
        submitLabel="별점 저장"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '별점 저장' }))

    expect(onSave).toHaveBeenCalledWith({ bookChatId, rating: 5, review: null })
  })
})
