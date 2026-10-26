import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { MobileButton } from '../../shared/ui/MobileButton'
import { mobileRadius, mobileSpacing, mobileTouchTarget, withAlpha } from '../../shared/ui/mobileLayout'
import { mobileColors } from '../../shared/ui/mobileTheme'
import type { PhotoSource } from '../photo-quote'

export type MobileLabelKind = 'page' | 'chapter'

/** 메시지 추가 시트의 화면. photo-source는 사진에서 가져오기의 카메라·앨범 선택이다. */
export type MobileMenuView = 'root' | 'quote' | 'label' | 'video' | 'photo-source'

const menuTitles: Record<MobileMenuView, string> = {
  label: '라벨',
  'photo-source': '사진에서 가져오기',
  quote: '문장 인용',
  root: '메시지 추가',
  video: '영상',
}

/** 사진을 고르기 직전에 보여 주는 촬영 안내. 막지 않고 정확도를 높이는 방법만 알린다. */
export const photoQuoteShootingHint = '한 페이지만, 위에서 평평하게 찍으면 더 정확해요.'

type MobileMessageActionSheetProps = {
  canCreateRoomInvite: boolean
  initialView: MobileMenuView
  isInviteBusy: boolean
  isReplying: boolean
  /** 라벨 종류와 값을 받아 입력 라벨에 더하고, 값이 올바르지 않으면 false를 반환한다. */
  onAddLabel(kind: MobileLabelKind, value: string): boolean
  onClose(): void
  onOpenRating(): void
  onOpenRoomInvite(): void
  onOpenVideoArchive(): void
  onOpenVideoUpload(): void
  onPickPhoto(source: PhotoSource): void
  onRequestRoomInvite(): void
  onWriteQuote(): void
}

/**
 * 책 대화 입력창 `+`의 "메시지 추가" 하단 시트를 표시한다. 웹과 같은 순서(문장 인용·라벨·영상·별점·초대)로,
 * 문장 인용·라벨·영상은 같은 시트 안의 하위 화면으로 나뉜다. 항목을 고르면 시트를 닫고 실행한다.
 */
export function MobileMessageActionSheet({
  initialView,
  onClose,
  ...menuProps
}: MobileMessageActionSheetProps): React.JSX.Element {
  const [view, setView] = useState<MobileMenuView>(initialView)
  const title = menuTitles[view]

  return (
    <View accessibilityViewIsModal style={styles.backdrop}>
      <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={onClose} style={styles.scrim} />
      <View accessibilityLabel={title} style={styles.sheet}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <MobileButton accessibilityLabel={`${title} 닫기`} label="닫기" onPress={onClose} variant="ghost" />
        </View>
        {view === 'root' ? null : (
          <MobileButton
            accessibilityLabel="메시지 추가 메뉴로 돌아가기"
            label="이전"
            onPress={() => setView('root')}
            style={styles.backAction}
            variant="ghost"
          />
        )}
        <ScrollView keyboardShouldPersistTaps="handled">
          <MenuBody {...menuProps} onClose={onClose} onOpenView={setView} view={view} />
        </ScrollView>
      </View>
    </View>
  )
}

type MenuBodyProps = Omit<MobileMessageActionSheetProps, 'initialView'> & {
  onOpenView(view: MobileMenuView): void
  view: MobileMenuView
}

type Choice = { isDisabled?: boolean; label: string; onSelect(): void }

/** 현재 화면에 맞는 선택지 목록 또는 라벨 입력을 고른다. */
function MenuBody(props: MenuBodyProps): React.JSX.Element {
  if (props.view === 'label') return <LabelEditor onAddLabel={props.onAddLabel} onClose={props.onClose} />
  const isPhotoChoice = props.view === 'quote' || props.view === 'photo-source'
  return (
    <View style={styles.list}>
      {isPhotoChoice ? <Text style={styles.hint}>{photoQuoteShootingHint}</Text> : null}
      <ChoiceList choices={getChoices(props)} />
    </View>
  )
}

/** 화면별 선택지를 정한다. 하위 화면으로 가는 항목은 시트를 닫지 않고 화면만 바꾼다. */
function getChoices(props: MenuBodyProps): Choice[] {
  if (props.view === 'quote')
    return [
      { label: '사진에서 가져오기', onSelect: () => props.onOpenView('photo-source') },
      { label: '직접 입력', onSelect: closeThen(props, props.onWriteQuote) },
    ]
  if (props.view === 'photo-source')
    return [
      { label: '카메라로 찍기', onSelect: closeThen(props, () => props.onPickPhoto('camera')) },
      { label: '앨범에서 고르기', onSelect: closeThen(props, () => props.onPickPhoto('library')) },
    ]
  if (props.view === 'video')
    return [
      { label: '영상 올리기', onSelect: closeThen(props, props.onOpenVideoUpload) },
      { label: '영상 기록', onSelect: closeThen(props, props.onOpenVideoArchive) },
    ]
  return getRootChoices(props)
}

/** 첫 화면의 다섯 항목을 웹과 같은 순서로 정한다. 답글에는 라벨을 붙일 수 없어 비활성화한다. */
function getRootChoices(props: MenuBodyProps): Choice[] {
  const invite: Choice = props.canCreateRoomInvite
    ? { isDisabled: props.isInviteBusy, label: '책방 초대하기', onSelect: closeThen(props, props.onOpenRoomInvite) }
    : { isDisabled: props.isInviteBusy, label: '초대 요청', onSelect: closeThen(props, props.onRequestRoomInvite) }
  return [
    { label: '문장 인용', onSelect: () => props.onOpenView('quote') },
    { isDisabled: props.isReplying, label: '라벨', onSelect: () => props.onOpenView('label') },
    { label: '영상', onSelect: () => props.onOpenView('video') },
    { label: '별점', onSelect: closeThen(props, props.onOpenRating) },
    invite,
  ]
}

/** 시트를 먼저 닫고 고른 행동을 실행하는 처리기를 만든다. */
function closeThen(props: Pick<MenuBodyProps, 'onClose'>, action: () => void): () => void {
  return () => {
    props.onClose()
    action()
  }
}

/** 선택지를 44px 이상의 목록 행으로 표시한다. */
function ChoiceList({ choices }: { choices: Choice[] }): React.JSX.Element {
  return (
    <View style={styles.list}>
      {choices.map((choice) => (
        <Pressable
          accessibilityLabel={choice.label}
          accessibilityRole="button"
          accessibilityState={{ disabled: choice.isDisabled ?? false }}
          disabled={choice.isDisabled ?? false}
          key={choice.label}
          onPress={choice.onSelect}
          style={({ pressed }) => [styles.choice, pressed && styles.choicePressed, choice.isDisabled && styles.choiceDisabled]}
        >
          <Text style={styles.choiceText}>{choice.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const labelTabs: Array<{ kind: MobileLabelKind; name: string }> = [
  { kind: 'page', name: '페이지' },
  { kind: 'chapter', name: '챕터' },
]

/** 페이지·챕터 탭과 값 입력으로 라벨을 더한다. 탭마다 임시 입력을 따로 보존한다. */
function LabelEditor({ onAddLabel, onClose }: Pick<MenuBodyProps, 'onAddLabel' | 'onClose'>): React.JSX.Element {
  const [labelKind, setLabelKind] = useState<MobileLabelKind>('page')
  const [drafts, setDrafts] = useState<Record<MobileLabelKind, string>>({ chapter: '', page: '' })
  const inputLabel = labelKind === 'page' ? '페이지 번호' : '챕터 이름 또는 번호'

  /** 현재 탭의 라벨을 더하고, 성공하면 시트를 닫는다. 올바르지 않은 값은 고칠 수 있게 그대로 둔다. */
  function handleAddLabel(): void {
    if (!onAddLabel(labelKind, drafts[labelKind])) return
    onClose()
  }

  return (
    <View style={styles.labelEditor}>
      <View accessibilityLabel="라벨 종류" accessibilityRole="tablist" style={styles.tabs}>
        {labelTabs.map((tab) => (
          <Pressable
            accessibilityLabel={tab.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: labelKind === tab.kind }}
            key={tab.kind}
            onPress={() => setLabelKind(tab.kind)}
            style={[styles.tab, labelKind === tab.kind && styles.tabSelected]}
          >
            <Text style={[styles.tabText, labelKind === tab.kind && styles.tabTextSelected]}>{tab.name}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.labelRow}>
        <TextInput
          accessibilityLabel={inputLabel}
          autoFocus
          key={labelKind}
          onChangeText={(value) => setDrafts((current) => ({ ...current, [labelKind]: value }))}
          onSubmitEditing={handleAddLabel}
          placeholder={labelKind === 'page' ? '예: 87' : '예: 3장 또는 고독'}
          placeholderTextColor={mobileColors.placeholder}
          returnKeyType="done"
          style={styles.labelInput}
          value={drafts[labelKind]}
        />
        <MobileButton accessibilityLabel="라벨 추가" label="추가" onPress={handleAddLabel} variant="neutral" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  backAction: { alignSelf: 'flex-start' },
  backdrop: { bottom: 0, justifyContent: 'flex-end', left: 0, position: 'absolute', right: 0, top: 0 },
  choice: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: mobileSpacing.md,
  },
  choiceDisabled: { opacity: 0.4 },
  choicePressed: { opacity: 0.7 },
  choiceText: { color: mobileColors.ink, fontSize: 16, fontWeight: '500', lineHeight: 22 },
  hint: { color: mobileColors.inkSubtle, fontSize: 14, lineHeight: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  labelEditor: { gap: mobileSpacing.sm },
  labelInput: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    color: mobileColors.ink,
    flex: 1,
    fontSize: 16,
    minHeight: mobileTouchTarget,
    paddingHorizontal: mobileSpacing.sm,
  },
  labelRow: { alignItems: 'center', flexDirection: 'row', gap: mobileSpacing.xs },
  list: { gap: mobileSpacing.xs },
  scrim: { backgroundColor: withAlpha(mobileColors.surface, 0.72), bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: {
    backgroundColor: mobileColors.surface,
    borderColor: mobileColors.border,
    borderTopLeftRadius: mobileRadius.sheet,
    borderTopRightRadius: mobileRadius.sheet,
    borderTopWidth: 1,
    gap: mobileSpacing.sm,
    maxHeight: '82%',
    paddingBottom: mobileSpacing.lg,
    paddingHorizontal: mobileSpacing.md,
    paddingTop: mobileSpacing.sm,
  },
  tab: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: mobileTouchTarget },
  tabSelected: { backgroundColor: mobileColors.surfaceRaised, borderBottomColor: mobileColors.ink, borderBottomWidth: 2 },
  tabText: { color: mobileColors.inkSubtle, fontSize: 14, fontWeight: '600' },
  tabTextSelected: { color: mobileColors.ink },
  tabs: { borderColor: mobileColors.border, borderRadius: mobileRadius.md, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  title: { color: mobileColors.ink, fontSize: 18, fontWeight: '600', lineHeight: 26 },
})
