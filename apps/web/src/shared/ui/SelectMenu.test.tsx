import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SelectMenu } from './SelectMenu'

const options = [
  { label: '전체', value: 'all' },
  { label: '내 영상', value: 'mine' },
  { label: '민규', value: 'member-1' },
]

describe('SelectMenu', () => {
  afterEach(cleanup)

  it('opens from the keyboard and moves option focus with arrow, home, and end keys', async () => {
    const onChange = vi.fn()
    render(<SelectMenu label="영상 필터" onChange={onChange} options={options} value="mine" />)

    const trigger = screen.getByRole('button', { name: '영상 필터: 내 영상' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const mineOption = await screen.findByRole('option', { name: '내 영상' })
    expect(mineOption).toHaveFocus()

    fireEvent.keyDown(mineOption, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: '민규' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('option', { name: '민규' }), { key: 'Home' })
    expect(screen.getByRole('option', { name: '전체' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('option', { name: '전체' }), { key: 'End' })
    expect(screen.getByRole('option', { name: '민규' })).toHaveFocus()
  })

  it('selects the focused option with Enter and restores trigger focus after Escape', async () => {
    const onChange = vi.fn()
    render(<SelectMenu label="영상 필터" onChange={onChange} options={options} value="mine" />)

    const trigger = screen.getByRole('button', { name: '영상 필터: 내 영상' })
    fireEvent.click(trigger)
    const mineOption = await screen.findByRole('option', { name: '내 영상' })

    fireEvent.keyDown(mineOption, { key: 'ArrowUp' })
    fireEvent.keyDown(screen.getByRole('option', { name: '전체' }), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('all')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('selects the focused option with Space', async () => {
    const onChange = vi.fn()
    render(<SelectMenu label="영상 필터" onChange={onChange} options={options} value="all" />)

    fireEvent.click(screen.getByRole('button', { name: '영상 필터: 전체' }))
    const allOption = await screen.findByRole('option', { name: '전체' })
    fireEvent.keyDown(allOption, { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('option', { name: '내 영상' }), { key: ' ' })

    expect(onChange).toHaveBeenCalledWith('mine')
  })
})
