export { completeOnboarding, createInitialProfileForm } from './completeOnboarding'
export { getOnboardingCompletedAt } from './getOnboardingStatus'
export { getProfile } from './getProfile'
export {
  createAvatarObjectPath,
  getAvatarUploadError,
  getProfileAvatarUrl,
  uploadProfileAvatar,
  validateAvatarUpload,
  type AvatarFile,
} from './avatarUpload'
export { getProviderLabels } from './authIdentity'
export {
  AccountDeletionError,
  requestAccountDeletion,
  type AccountDeletionMode,
} from './accountDeletion'
export {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from './notificationPreferences'
export { profileFormSchema, type ProfileForm } from './profileForm'
export { updateProfile } from './updateProfile'
