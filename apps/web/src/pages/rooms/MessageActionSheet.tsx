import { useRef, useState, type KeyboardEvent, type RefObject } from 'react'

import { ActionButton as SeedActionButton, TextField } from '@seed-design/react'

import { BottomSheet } from '../../shared/ui/BottomSheet'

export type MessageLabelKind = 'page' | 'chapter'

type MenuView = 'root' | 'quote' | 'label' | 'video'

type SubmenuView = Exclude<MenuView, 'root'>

const menuTitles: Record<MenuView, string> = {
  label: '라벨',
  quote: '문장 인용',
  root: '메시지 추가',
  video: '영상',
}

/** 사진을 고르기 직전에 보여 주는 촬영 안내. 막지 않고 정확도를 높이는 방법만 알린다. */
export const photoQuoteShootingHint = '한 페이지만, 위에서 평평하게 찍으면 더 정확해요.'

const labelTabs: Array<{ kind: MessageLabelKind; name: string }> = [
  { kind: 'page', name: '페이지' },
  { kind: 'chapter', name: '챕터' },
]

type MessageActionSheetProps = {
  canCreateRoomInvite: boolean
  hasBookChat: boolean
  inviteTriggerRef: RefObject<HTMLButtonElement | null>
  isReplying: boolean
  isRequestingRoomInvite: boolean
  /** 라벨 종류와 값을 받아 입력 라벨에 더하고, 값이 올바르지 않아 더하지 못하면 false를 반환한다. */
  onAddLabel: (kind: MessageLabelKind, value: string) => boolean
  /** 시트를 닫는다. false면 트리거 버튼으로 포커스를 돌려주지 않는다(다음 화면이 포커스를 가져간다). */
  onClose: (shouldRestoreFocus?: boolean) => void
  onOpenRating: () => void
  onOpenRoomInvite: () => void
  onOpenVideoArchive: () => void
  onPickPhoto: () => void
  onPickVideo: () => void
  onRequestRoomInvite: () => void
  onWriteQuote: () => void
  returnFocusRef: RefObject<HTMLElement | null>
  shouldRestoreFocus: () => boolean
}

/**
 * 책 대화 입력창 `+`의 "메시지 추가" 시트를 렌더링한다. 첫 화면은 문장 인용·라벨·영상·별점·초대 순서이고,
 * 문장 인용·라벨·영상은 같은 시트 안의 하위 화면으로 나뉜다. 라벨 임시 입력은 시트가 닫히면 버린다.
 */
export function MessageActionSheet({
  onClose,
  returnFocusRef,
  shouldRestoreFocus,
  ...menuProps
}: MessageActionSheetProps) {
  const [view, setView] = useState<MenuView>('root')
  const rootItemRefs = useRef<Partial<Record<SubmenuView, HTMLButtonElement | null>>>({})

  /** 하위 화면에서 첫 화면으로 돌아가고, 들어왔던 항목으로 포커스를 돌려준다. */
  function handleReturnToRoot() {
    const previousView = view
    setView('root')
    if (previousView === 'root') return
    window.requestAnimationFrame(() => rootItemRefs.current[previousView]?.focus())
  }

  return (
    <BottomSheet
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      shouldRestoreFocus={shouldRestoreFocus}
      title={menuTitles[view]}
    >
      {view === 'root' ? (
        <RootMenu
          {...menuProps}
          onClose={onClose}
          onOpenView={setView}
          rootItemRefs={rootItemRefs}
        />
      ) : (
        <div className="space-y-3">
          <div className="mb-2 flex min-h-11 items-center gap-2">
            <SeedActionButton
              aria-label="메시지 추가 메뉴로 돌아가기"
              onClick={handleReturnToRoot}
              type="button"
              variant="ghost"
            >
              이전
            </SeedActionButton>
          </div>
          <SubmenuBody {...menuProps} onClose={onClose} view={view} />
        </div>
      )}
    </BottomSheet>
  )
}

type MenuBodyProps = Omit<MessageActionSheetProps, 'returnFocusRef' | 'shouldRestoreFocus'>

/** 메시지 추가 첫 화면의 다섯 항목을 정해진 순서로 렌더링한다. */
function RootMenu({
  canCreateRoomInvite,
  inviteTriggerRef,
  isReplying,
  isRequestingRoomInvite,
  onClose,
  onOpenRating,
  onOpenRoomInvite,
  onOpenView,
  onRequestRoomInvite,
  rootItemRefs,
}: MenuBodyProps & {
  onOpenView: (view: SubmenuView) => void
  rootItemRefs: RefObject<Partial<Record<SubmenuView, HTMLButtonElement | null>>>
}) {
  /** 하위 화면 항목 버튼을 기억해 돌아올 때 포커스를 복귀할 수 있게 한다. */
  function registerRootItem(view: SubmenuView) {
    return (element: HTMLButtonElement | null) => {
      rootItemRefs.current[view] = element
    }
  }

  return (
    <div className="talkhugam-action-sheet-list">
      <SeedActionButton
        className="talkhugam-action-sheet-choice"
        onClick={() => onOpenView('quote')}
        ref={registerRootItem('quote')}
        variant="neutralWeak"
      >
        문장 인용
      </SeedActionButton>
      <SeedActionButton
        className="talkhugam-action-sheet-choice"
        disabled={isReplying}
        onClick={() => onOpenView('label')}
        ref={registerRootItem('label')}
        variant="neutralWeak"
      >
        라벨
      </SeedActionButton>
      <SeedActionButton
        className="talkhugam-action-sheet-choice"
        onClick={() => onOpenView('video')}
        ref={registerRootItem('video')}
        variant="neutralWeak"
      >
        영상
      </SeedActionButton>
      <SeedActionButton
        className="talkhugam-action-sheet-choice"
        onClick={() => {
          onClose(false)
          onOpenRating()
        }}
        variant="neutralWeak"
      >
        별점
      </SeedActionButton>
      {canCreateRoomInvite ? (
        <SeedActionButton
          className="talkhugam-action-sheet-choice"
          onClick={() => {
            onClose(false)
            onOpenRoomInvite()
          }}
          ref={inviteTriggerRef}
          variant="neutralWeak"
        >
          책방 초대하기
        </SeedActionButton>
      ) : (
        <SeedActionButton
          className="talkhugam-action-sheet-choice"
          disabled={isRequestingRoomInvite}
          onClick={() => {
            onClose()
            onRequestRoomInvite()
          }}
          variant="neutralWeak"
        >
          초대 요청
        </SeedActionButton>
      )}
    </div>
  )
}

/** 현재 하위 화면(문장 인용·라벨·영상)에 맞는 본문을 고른다. */
function SubmenuBody({ view, ...props }: MenuBodyProps & { view: SubmenuView }) {
  if (view === 'label') return <LabelEditor onAddLabel={props.onAddLabel} onClose={props.onClose} />
  if (view === 'quote')
    return (
      <>
        <p className="text-ink-subtle talkhugam-balanced-copy text-sm">{photoQuoteShootingHint}</p>
        <ChoiceList
          choices={[
            {
              isDisabled: !props.hasBookChat,
              label: '사진에서 가져오기',
              onSelect: props.onPickPhoto,
            },
            { isDisabled: !props.hasBookChat, label: '직접 입력', onSelect: props.onWriteQuote },
          ]}
          onClose={props.onClose}
        />
      </>
    )
  return (
    <ChoiceList
      choices={[
        { label: '영상 올리기', onSelect: props.onPickVideo },
        { label: '영상 기록', onSelect: props.onOpenVideoArchive },
      ]}
      onClose={props.onClose}
    />
  )
}

type Choice = { isDisabled?: boolean; label: string; onSelect: () => void }

/** 하위 화면의 두 갈래 선택지를 같은 시트 목록 모양으로 렌더링하고, 고르면 시트를 닫은 뒤 실행한다. */
function ChoiceList({
  choices,
  onClose,
}: {
  choices: Choice[]
  onClose: (shouldRestoreFocus?: boolean) => void
}) {
  return (
    <div className="talkhugam-action-sheet-list">
      {choices.map((choice, index) => (
        <SeedActionButton
          autoFocus={index === 0}
          className="talkhugam-action-sheet-choice"
          disabled={choice.isDisabled ?? false}
          key={choice.label}
          onClick={() => {
            onClose(false)
            choice.onSelect()
          }}
          variant="neutralWeak"
        >
          {choice.label}
        </SeedActionButton>
      ))}
    </div>
  )
}

/** 페이지·챕터 탭과 값 입력으로 라벨을 더한다. 탭마다 임시 입력을 따로 보존한다. */
function LabelEditor({ onAddLabel, onClose }: Pick<MenuBodyProps, 'onAddLabel' | 'onClose'>) {
  const [labelKind, setLabelKind] = useState<MessageLabelKind>('page')
  const [labelDrafts, setLabelDrafts] = useState<Record<MessageLabelKind, string>>({
    chapter: '',
    page: '',
  })
  const inputLabel = labelKind === 'page' ? '페이지 번호' : '챕터 이름 또는 번호'

  /** 현재 탭의 라벨을 더하고, 성공하면 시트를 닫는다. 올바르지 않은 값은 고칠 수 있게 그대로 둔다. */
  function handleAddLabel() {
    if (!onAddLabel(labelKind, labelDrafts[labelKind])) return
    onClose(false)
  }

  /** 라벨 입력창에서 Enter를 누르면 현재 라벨을 추가한다. */
  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAddLabel()
  }

  return (
    <>
      <div
        aria-label="라벨 종류"
        className="border-border grid grid-cols-2 overflow-hidden rounded-md border"
        role="tablist"
      >
        {labelTabs.map((tab, index) => (
          <button
            aria-controls="post-label-panel"
            aria-selected={labelKind === tab.kind}
            className={`min-h-11 text-sm font-semibold ${index > 0 ? 'border-border border-l' : ''} ${
              labelKind === tab.kind ? 'talkhugam-tab--selected' : 'bg-surface text-ink-subtle'
            }`}
            key={tab.kind}
            onClick={() => setLabelKind(tab.kind)}
            role="tab"
            type="button"
          >
            {tab.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2" id="post-label-panel" role="tabpanel">
        <label className="sr-only" htmlFor="post-label-value">
          {inputLabel}
        </label>
        <TextField.Root className="talkhugam-information-field min-w-0 flex-1">
          <TextField.Input
            autoFocus
            aria-label={inputLabel}
            id="post-label-value"
            key={labelKind}
            onChange={(event) =>
              setLabelDrafts((drafts) => ({ ...drafts, [labelKind]: event.target.value }))
            }
            onKeyDown={handleInputKeyDown}
            placeholder={labelKind === 'page' ? '예: 87' : '예: 3장 또는 고독'}
            value={labelDrafts[labelKind]}
          />
        </TextField.Root>
        <SeedActionButton
          aria-label="라벨 추가"
          className="talkhugam-primary-action"
          onClick={handleAddLabel}
          type="button"
        >
          추가
        </SeedActionButton>
      </div>
    </>
  )
}
