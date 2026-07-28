import React from 'react';
import { theme } from './lib/theme';
import { api, firstError } from './api';
import { humanSize, fmtStorage, kindOf, previewKindOf, fmtDuration } from './lib/ui';
import { renderMarkdown } from './lib/markdown';
import AppView from './view/AppView';

export default class App extends React.Component {
  state = {
    files: this.buildFiles(),
    authView: 'login',
    authName: '',
    authEmail: '',
    authPassword: '',
    authDob: '',
    authError: '',
    authBusy: false,
    usedGB: 4.6,
    newFolderName: '',
    videoVolume: 1,
    videoRate: 1,
    videoLoading: false,
    deviceMode: 'desktop',
    vw: typeof window !== 'undefined' ? window.innerWidth : 1200,
    currentFolderId: null,
    filterKey: 'all',
    sortBy: 'name', // 'name' | 'size'
    viewMode: 'grid', // 'grid' | 'list'
    searchQuery: '',
    searchType: 'all', // all | folder | image | video | doc | audio
    mobileSearchOpen: false,
    drawerOpen: false,
    modal: null,
    activeFileId: null,
    // File preview (real uploads fetch a URL / text content on open).
    previewKind: 'doc',
    previewUrl: '',
    previewText: '',
    previewLoading: false,
    previewError: '',
    // Edit-in-place for text files.
    editing: false,
    editText: '',
    editSaving: false,
    // Rename / move dialogs.
    renameName: '',
    renameTargetId: null,
    renameIsFolder: false,
    moveTargetId: null,
    moveIsFolder: false,
    moveDestId: null,
    // Share-link management.
    linksList: [],
    linksLoading: false,
    // Drag-and-drop move.
    draggingId: null,
    dragOverId: null,
    // Bulk selection.
    selectedIds: [],
    moveBulk: false,
    settingsTab: 'profile',
    profileName: '',
    profileUsername: '',
    profileBio: '',
    accountEmail: '',
    emailVerified: false,
    twofa: false,
    pwCurrent: '',
    pwNew: '',
    pwConfirm: '',
    uploadQueue: [],
    shareAccess: 'restricted',
    sharePermission: 'view',
    shareEmails: [],
    shareEmailInput: '',
    shareCopied: false,
    shareLinkUrl: '',
    videoPlaying: false,
    videoProgress: 0,
    videoCurrent: 0,
    videoDuration: 0,
    videoMuted: false,
    videoCC: true,
    videoFullscreen: false,
    unreadCount: 0,
    discoverResults: [],
    realUsedBytes: null,
    realQuotaBytes: null,
    ctxMenu: null,
    toastMsg: '',
  };

  buildFiles() {
    const P = (s) => `https://picsum.photos/seed/${s}/640/420`;
    const V = 'https://storage.googleapis.com/gtv-videos-bucket/sample/';
    const PDF = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';
    return [
      { id: 'f-shoots', name: 'Product Shoots', kind: 'folder', parentId: null, trashed: false },
      { id: 'f-team', name: 'Team Recordings', kind: 'folder', parentId: null, trashed: false },
      { id: 'f-docs', name: 'Client Docs', kind: 'folder', parentId: null, trashed: false },
      { id: 'f-backup', name: 'Personal Backup', kind: 'folder', parentId: null, trashed: false },
      {
        id: 'file-keynote',
        name: 'Q3-brand-keynote.mp4',
        kind: 'video',
        parentId: null,
        size: '842 MB',
        modified: '2d ago',
        duration: '9:56',
        poster: P('keynote'),
        videoSrc: V + 'BigBuckBunny.mp4',
        watchedPct: 35,
        shared: true,
        starred: false,
        trashed: false,
        recentRank: 1,
      },
      {
        id: 'file-family',
        name: 'family-reunion.jpg',
        kind: 'image',
        parentId: null,
        size: '4.2 MB',
        modified: '1w ago',
        poster: P('family'),
        shared: false,
        starred: true,
        trashed: false,
        recentRank: 3,
      },
      {
        id: 'file-invoice',
        name: 'invoice-oct.pdf',
        kind: 'doc',
        parentId: null,
        size: '210 KB',
        modified: '3d ago',
        docUrl: PDF,
        shared: true,
        starred: false,
        trashed: false,
        recentRank: 5,
      },
      {
        id: 'file-memo',
        name: 'voice-memo.mp3',
        kind: 'audio',
        parentId: null,
        size: '3.8 MB',
        modified: '5d ago',
        audioSrc: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
        shared: false,
        starred: false,
        trashed: false,
        recentRank: 8,
      },
      {
        id: 'file-hero1',
        name: 'hero-shot-01.jpg',
        kind: 'image',
        parentId: 'f-shoots',
        size: '6.1 MB',
        modified: '4h ago',
        poster: P('hero1'),
        shared: true,
        starred: false,
        trashed: false,
        recentRank: 2,
      },
      {
        id: 'file-hero2',
        name: 'hero-shot-02.jpg',
        kind: 'image',
        parentId: 'f-shoots',
        size: '5.8 MB',
        modified: '4h ago',
        poster: P('hero2'),
        shared: false,
        starred: false,
        trashed: false,
        recentRank: 7,
      },
      {
        id: 'file-turntable',
        name: 'product-turntable.mp4',
        kind: 'video',
        parentId: 'f-shoots',
        size: '96 MB',
        modified: '4h ago',
        duration: '0:45',
        poster: P('turntable'),
        videoSrc: V + 'ForBiggerJoyrides.mp4',
        watchedPct: 0,
        shared: false,
        starred: false,
        trashed: false,
        recentRank: 6,
      },
      {
        id: 'file-lighting',
        name: 'lighting-notes.pdf',
        kind: 'doc',
        parentId: 'f-shoots',
        size: '88 KB',
        modified: '1d ago',
        docUrl: PDF,
        shared: false,
        starred: false,
        trashed: false,
        recentRank: 9,
      },
      {
        id: 'file-standup',
        name: 'standup-mon.mp4',
        kind: 'video',
        parentId: 'f-team',
        size: '210 MB',
        modified: '1d ago',
        duration: '15:00',
        poster: P('standup'),
        videoSrc: V + 'ForBiggerBlazes.mp4',
        watchedPct: 60,
        shared: false,
        starred: false,
        trashed: false,
        recentRank: 4,
      },
      {
        id: 'file-review',
        name: 'design-review.mp4',
        kind: 'video',
        parentId: 'f-team',
        size: '340 MB',
        modified: '2d ago',
        duration: '15:00',
        poster: P('review'),
        videoSrc: V + 'ForBiggerEscapes.mp4',
        watchedPct: 12,
        shared: false,
        starred: false,
        trashed: false,
        recentRank: 10,
      },
      {
        id: 'file-onboarding',
        name: 'onboarding-walkthrough.mp4',
        kind: 'video',
        parentId: 'f-team',
        size: '150 MB',
        modified: '6d ago',
        duration: '15:00',
        poster: P('onboard'),
        videoSrc: V + 'ForBiggerFun.mp4',
        watchedPct: 90,
        shared: false,
        starred: false,
        trashed: false,
        recentRank: 11,
      },
      {
        id: 'file-olddraft',
        name: 'old-draft.pdf',
        kind: 'doc',
        parentId: null,
        size: '44 KB',
        modified: '5d ago',
        docUrl: PDF,
        shared: false,
        starred: false,
        trashed: true,
        deletedDaysAgo: 5,
      },
      {
        id: 'file-meme',
        name: 'meme.png',
        kind: 'image',
        parentId: null,
        size: '1.1 MB',
        modified: '1d ago',
        poster: P('meme'),
        shared: false,
        starred: false,
        trashed: true,
        deletedDaysAgo: 1,
      },
    ];
  }

  toast(msg) {
    this.setState({ toastMsg: msg });
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.setState({ toastMsg: '' }), 2200);
  }

  // On load: prime CSRF cookie, then restore an existing session if there is one.
  bootstrapSession() {
    api.getCsrf().catch(() => {});
    api
      .me()
      .then((user) => this.applySession(user))
      .catch(() => {}); // not logged in -> stay on the login screen
  }

  componentDidMount() {
    this._onResize = () => this.setState({ vw: window.innerWidth });
    window.addEventListener('resize', this._onResize);
    this._onResize();
    this._onKey = (e) => {
      if (e.key === 'Escape') {
        if (this.state.ctxMenu) this.closeCtxMenu();
        else if (this.state.modal) this.closeModal();
        else if (this.state.drawerOpen) this.closeDrawer();
        return;
      }
      // Arrow keys page through the image gallery in the preview modal.
      if (
        this.state.modal === 'preview' &&
        this.state.previewKind === 'image' &&
        !this.state.editing
      ) {
        if (e.key === 'ArrowLeft') this.previewStep(-1);
        else if (e.key === 'ArrowRight') this.previewStep(1);
      }
    };
    window.addEventListener('keydown', this._onKey);
    this.bootstrapSession();
    try {
      const raw = localStorage.getItem('floppydisk-state');
      if (raw) {
        const d = JSON.parse(raw);
        // Never rehydrate server-owned files: the server (loadStorage) is
        // authoritative, so a file deleted server-side must not be resurrected
        // from a stale local cache. Verified status likewise comes from /me.
        const restored = (d.files || this.state.files).filter((f) => !f.real);
        this.setState({
          files: restored,
          usedGB: d.usedGB != null ? d.usedGB : this.state.usedGB,
          profileName: d.profileName || this.state.profileName,
          profileUsername: d.profileUsername || this.state.profileUsername,
          profileBio: d.profileBio || this.state.profileBio,
        });
      }
    } catch (e) {}
  }
  componentWillUnmount() {
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this._onKey) window.removeEventListener('keydown', this._onKey);
    clearInterval(this._videoTimer);
  }
  _persist() {
    try {
      const s = this.state;
      localStorage.setItem(
        'floppydisk-state',
        JSON.stringify({
          // Only local/demo files are cached; server-owned files come from the
          // server on load (see componentDidMount).
          files: s.files.filter((f) => !f.real),
          usedGB: s.usedGB,
          profileName: s.profileName,
          profileUsername: s.profileUsername,
          profileBio: s.profileBio,
        })
      );
    } catch (e) {}
  }
  componentDidUpdate() {
    clearTimeout(this._pT);
    this._pT = setTimeout(() => this._persist(), 400);
  }

  setDesktop() {
    this.setState({ deviceMode: 'desktop', drawerOpen: false });
  }
  setMobile() {
    this.setState({ deviceMode: 'mobile' });
  }

  gotoRegister() {
    this.setState({ authView: 'register', authError: '' });
  }
  gotoLogin() {
    this.setState({ authView: 'login', authError: '' });
  }
  gotoForgot() {
    this.setState({ authView: 'forgot', authError: '' });
  }
  logout() {
    api.logout().catch(() => {});
    this.setState({
      authView: 'login',
      modal: null,
      drawerOpen: false,
      authEmail: '',
      authPassword: '',
      authError: '',
    });
  }
  setAuthName(e) {
    this.setState({ authName: e.target.value, authError: '' });
  }
  setAuthEmail(e) {
    this.setState({ authEmail: e.target.value, authError: '' });
  }
  setAuthPassword(e) {
    this.setState({ authPassword: e.target.value, authError: '' });
  }
  setAuthDob(e) {
    this.setState({ authDob: e.target.value, authError: '' });
  }

  // Adopt a User payload from the backend into the app's session state.
  applySession(user) {
    this.setState({
      authView: 'app',
      authError: '',
      authPassword: '',
      accountEmail: user.email,
      emailVerified: !!user.email_verified,
      profileName: user.display_name || this.state.profileName,
      twofa: !!user.two_factor_enabled,
    });
    this.loadStorage();
    this.loadUsage();
    this.loadNotifications();
  }

  // Real quota/usage for the sidebar meter (falls back to demo values on failure).
  loadUsage() {
    api
      .usage()
      .then((u) =>
        this.setState({
          realUsedBytes: u.used_bytes != null ? u.used_bytes : 0,
          realQuotaBytes: u.quota_bytes != null ? u.quota_bytes : null,
        })
      )
      .catch(() => {});
  }

  loadNotifications() {
    api
      .notifications()
      .then((r) => this.setState({ unreadCount: r.unread_count || 0 }))
      .catch(() => {});
  }

  authPrimary() {
    const s = this.state,
      v = s.authView;
    if (s.authBusy) return;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.authEmail.trim());
    if (v === 'login') {
      if (!emailOk) return this.setState({ authError: 'Enter a valid email address' });
      if (!s.authPassword) return this.setState({ authError: 'Enter your password' });
      this.setState({ authBusy: true, authError: '' });
      api
        .login(s.authEmail.trim(), s.authPassword)
        .then((user) => {
          this.setState({ authBusy: false });
          this.applySession(user);
        })
        .catch((err) =>
          this.setState({
            authBusy: false,
            authError: firstError(err, 'Incorrect email or password'),
          })
        );
    } else if (v === 'register') {
      if (!s.authName.trim()) return this.setState({ authError: 'Enter your full name' });
      if (!emailOk) return this.setState({ authError: 'Enter a valid email address' });
      if (s.authPassword.length < 8)
        return this.setState({ authError: 'Password must be at least 8 characters' });
      if (!s.authDob) return this.setState({ authError: 'Enter your date of birth' });
      this.setState({ authBusy: true, authError: '' });
      api
        .register({
          email: s.authEmail.trim(),
          password: s.authPassword,
          display_name: s.authName.trim(),
          date_of_birth: s.authDob,
        })
        .then((user) => {
          this.setState({ authBusy: false });
          this.applySession(user);
          this.toast('Welcome to Floppy Disk');
        })
        .catch((err) =>
          this.setState({ authBusy: false, authError: firstError(err, 'Could not create account') })
        );
    } else if (v === 'forgot') {
      if (!emailOk) return this.setState({ authError: 'Enter a valid email address' });
      this.setState({ authBusy: true, authError: '' });
      api
        .passwordReset(s.authEmail.trim())
        .then(() => {
          this.setState({ authBusy: false, authView: 'login' });
          this.toast('If that email exists, a reset link is on its way');
        })
        .catch(() => {
          this.setState({ authBusy: false, authView: 'login' });
          this.toast('If that email exists, a reset link is on its way');
        });
    }
  }
  toastForgot() {
    this.toast('Password reset link sent');
  }

  go(filterKey) {
    this.setState({
      filterKey,
      currentFolderId: null,
      searchQuery: '',
      drawerOpen: false,
      mobileSearchOpen: false,
      selectedIds: [],
    });
  }
  navToAll() {
    this.go('all');
  }
  navToFolder(id) {
    this.setState({ filterKey: 'all', currentFolderId: id, searchQuery: '', selectedIds: [] });
  }
  navToShared() {
    this.go('shared');
  }
  navToRecent() {
    this.go('recent');
  }
  navToTrash() {
    this.go('trash');
  }
  setSortBy(key) {
    this.setState({ sortBy: key });
  }
  setSearchType(t) {
    this.setState({ searchType: t });
  }
  setViewMode(mode) {
    this.setState({ viewMode: mode });
  }

  setSearch(e) {
    const v = e.target.value;
    this.setState({ searchQuery: v });
    clearTimeout(this._searchT);
    if (v.trim().length >= 2) {
      this._searchT = setTimeout(() => {
        api
          .search(v.trim())
          .then((r) => {
            const mapped = (r.results || []).map((x) => ({
              id: x.id,
              name: x.name,
              kind: x.kind,
              size: humanSize(x.size_bytes),
              parentId: null,
              trashed: false,
              shared: false,
              starred: false,
              discovered: !x.is_own,
              real: true,
            }));
            this.setState({ discoverResults: mapped });
          })
          .catch(() => {});
      }, 250);
    } else {
      this.setState({ discoverResults: [] });
    }
  }
  clearSearch() {
    clearTimeout(this._searchT);
    this.setState({ searchQuery: '', discoverResults: [], searchType: 'all' });
  }
  toggleMobileSearch() {
    this.setState((s) => ({ mobileSearchOpen: !s.mobileSearchOpen }));
  }
  openDrawer() {
    this.setState({ drawerOpen: true });
  }
  closeDrawer() {
    this.setState({ drawerOpen: false });
  }
  stop(e) {
    if (e) e.stopPropagation();
  }

  openSettings() {
    this.setState({
      modal: 'settings',
      settingsTab: 'profile',
      drawerOpen: false,
    });
  }
  setSettingsProfile() {
    this.setState({ settingsTab: 'profile' });
  }
  setSettingsAccount() {
    this.setState({ settingsTab: 'account' });
  }
  setSettingsSecurity() {
    this.setState({ settingsTab: 'security' });
  }
  setProfileName(e) {
    this.setState({ profileName: e.target.value });
  }
  setProfileUsername(e) {
    this.setState({ profileUsername: e.target.value });
  }
  setProfileBio(e) {
    this.setState({ profileBio: e.target.value });
  }
  saveProfile() {
    api
      .updateSettings({ display_name: (this.state.profileName || '').trim() })
      .then((s) => {
        if (s && s.display_name != null) this.setState({ profileName: s.display_name });
        this.toast('Profile saved');
      })
      .catch((err) => this.toast(firstError(err, 'Could not save profile')));
  }
  toastPhoto() {
    this.toast('Photo picker opened');
  }
  toastDelete() {
    api
      .deleteAccount()
      .then(() => {
        this.toast('Account deleted');
        this.logout();
      })
      .catch((err) => this.toast(firstError(err, 'Could not delete account')));
  }
  toastSessions() {
    this.toast('Signed out of all other sessions');
  }
  toggle2fa() {
    const next = !this.state.twofa;
    this.setState({ twofa: next }); // optimistic
    api
      .updateSettings({ two_factor_enabled: next })
      .then(() => this.toast(next ? 'Two-factor enabled' : 'Two-factor disabled'))
      .catch((err) => {
        this.setState({ twofa: !next }); // revert
        this.toast(firstError(err, 'Could not update 2FA'));
      });
  }
  setPwCurrent(e) {
    this.setState({ pwCurrent: e.target.value });
  }
  setPwNew(e) {
    this.setState({ pwNew: e.target.value });
  }
  setPwConfirm(e) {
    this.setState({ pwConfirm: e.target.value });
  }
  updatePassword() {
    const { pwCurrent, pwNew, pwConfirm } = this.state;
    if (!pwNew) {
      this.toast('Enter a new password');
      return;
    }
    if (pwNew !== pwConfirm) {
      this.toast('Passwords do not match');
      return;
    }
    api
      .changePassword(pwCurrent, pwNew)
      .then(() => {
        this.setState({ pwCurrent: '', pwNew: '', pwConfirm: '' });
        this.toast('Password updated');
      })
      .catch((err) => this.toast(firstError(err, 'Could not update password')));
  }
  resendVerification() {
    // Email verification is link-based: dispatch the email and let the user
    // complete it via the link. Status comes from the backend (/me).
    api
      .resendVerification()
      .then(() => this.toast('Verification email sent — check your inbox'))
      .catch((err) => this.toast(firstError(err, 'Could not send verification email')));
  }

  openNewFolder() {
    this.setState({ modal: 'newFolder', newFolderName: '' });
  }
  setNewFolderName(e) {
    this.setState({ newFolderName: e.target.value });
  }
  createFolder() {
    const name = this.state.newFolderName.trim();
    if (!name) {
      this.toast('Enter a folder name');
      return;
    }
    const cur = this.state.currentFolderId;
    const isUuid = typeof cur === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(cur);
    api
      .createFolder(name, isUuid ? cur : null)
      .then((folder) => {
        const item = {
          id: folder.id,
          name: folder.name,
          kind: 'folder',
          parentId: folder.parent || null,
          trashed: false,
          real: true,
        };
        this.setState((s) => ({ files: [item, ...s.files], modal: null, newFolderName: '' }));
        this.toast('Folder created');
      })
      .catch((err) => this.toast(firstError(err, 'Could not create folder')));
  }

  // Pull the user's real folders + files from the backend and merge them in
  // (dedupe by id, so we never duplicate what's already in state).
  loadStorage() {
    api
      .listFolders()
      .then((folders) => {
        this.setState((s) => {
          const existing = new Set(s.files.map((f) => f.id));
          const mapped = (folders || [])
            .filter((f) => !existing.has(f.id))
            .map((f) => ({
              id: f.id,
              name: f.name,
              kind: 'folder',
              parentId: f.parent || null,
              trashed: false,
              real: true,
            }));
          return mapped.length ? { files: [...mapped, ...s.files] } : null;
        });
      })
      .catch(() => {});
    api
      .listFiles()
      .then((files) => {
        this.setState((s) => {
          const existing = new Set(s.files.map((f) => f.id));
          const mapped = (files || [])
            .filter((f) => !existing.has(f.id))
            .map((f) => ({
              id: f.id,
              name: f.name,
              kind: f.kind,
              parentId: f.folder || null,
              size: humanSize(f.size_bytes),
              sizeBytes: f.size_bytes,
              modified: '',
              shared: false,
              starred: false,
              trashed: false,
              status: f.status,
              poster: f.poster_url || undefined,
              duration: fmtDuration(f.duration_seconds) || undefined,
              real: true,
            }));
          return mapped.length ? { files: [...mapped, ...s.files] } : null;
        });
      })
      .catch(() => {});
    api
      .trash()
      .then((t) => {
        const items = [
          ...(t.folders || []).map((f) => ({
            id: f.id,
            name: f.name,
            kind: 'folder',
            parentId: null,
          })),
          ...(t.files || []).map((f) => ({
            id: f.id,
            name: f.name,
            kind: f.kind,
            parentId: null,
            size: humanSize(f.size_bytes),
          })),
        ];
        this.setState((s) => {
          const existing = new Set(s.files.map((f) => f.id));
          const mapped = items
            .filter((f) => !existing.has(f.id))
            .map((f) => ({ ...f, modified: '', trashed: true, real: true }));
          return mapped.length ? { files: [...mapped, ...s.files] } : null;
        });
      })
      .catch(() => {});
  }
  // Poll a single (transcoding) video until it's ready, updating its poster +
  // status in place. Re-arms while the server still reports "processing".
  refreshFile(id) {
    const f = this.state.files.find((x) => x.id === id);
    if (!f) return;
    const isUuid = typeof f.parentId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(f.parentId);
    api
      .listFiles(isUuid ? f.parentId : undefined)
      .then((files) => {
        const fresh = (files || []).find((x) => x.id === id);
        if (!fresh) return;
        this.setState((s) => ({
          files: s.files.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: fresh.status,
                  poster: fresh.poster_url || x.poster,
                  duration: fmtDuration(fresh.duration_seconds) || x.duration,
                }
              : x
          ),
        }));
        if (fresh.status === 'processing') setTimeout(() => this.refreshFile(id), 3000);
      })
      .catch(() => {});
  }
  openUpload() {
    this.setState({ modal: 'upload', drawerOpen: false });
  }
  closeModal() {
    if (this._videoEl) {
      try {
        this._videoEl.pause();
      } catch (e) {}
    }
    this.setState({
      modal: null,
      activeFileId: null,
      videoPlaying: false,
      videoProgress: 0,
      videoCurrent: 0,
      videoDuration: 0,
      videoFullscreen: false,
      shareCopied: false,
      editing: false,
      editText: '',
    });
  }
  openFile(file) {
    if (file.kind === 'folder') {
      this.setState({
        currentFolderId: file.id,
        filterKey: 'all',
        searchQuery: '',
        selectedIds: [],
      });
      return;
    }
    if (file.kind === 'video') {
      this._videoEl = null;
      this._activeVideoSrc = file.videoSrc;
      this._activePoster = file.poster;
      this.setState({
        modal: 'video',
        activeFileId: file.id,
        videoPlaying: false,
        videoProgress: 0,
        videoCurrent: 0,
        videoDuration: 0,
        videoFullscreen: false,
      });
      if (file.real) {
        // Fetch a self-hosted playback URL for the (transcoded) MP4 rendition.
        api
          .play(file.id)
          .then((d) => {
            if (this.state.activeFileId !== file.id) return; // a newer file was opened
            this._activeVideoSrc = d.url;
            if (d.poster) this._activePoster = d.poster;
            this.forceUpdate();
          })
          .catch((err) => {
            // Still transcoding on the server — tell the user and close.
            if (err && err.status === 409) {
              this.toast('Video is still processing — try again shortly');
              this.closeModal();
            }
          });
      }
      return;
    }
    // Non-video preview (image / pdf / audio / markdown / json / yaml / text).
    const pk = previewKindOf(file.name, file.kind);
    const isText = pk === 'markdown' || pk === 'json' || pk === 'yaml' || pk === 'text';
    this.setState({
      modal: 'preview',
      activeFileId: file.id,
      previewKind: pk,
      previewUrl: '',
      previewText: '',
      previewError: '',
      previewLoading: !!file.real,
      editing: false,
      editText: '',
    });
    if (file.real) {
      // Fetch a real, same-origin URL for the bytes; for text formats also read
      // the content so we can render it (markdown/json/yaml/code).
      api
        .fileDownload(file.id)
        .then((d) => {
          if (this.state.activeFileId !== file.id) return; // a newer file was opened
          const url = (d && d.download_url) || '';
          if (isText) {
            return fetch(url)
              .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
              })
              .then((txt) => {
                if (this.state.activeFileId !== file.id) return;
                this.setState({ previewUrl: url, previewText: txt, previewLoading: false });
              });
          }
          this.setState({ previewUrl: url, previewLoading: false });
        })
        .catch(() => {
          if (this.state.activeFileId !== file.id) return;
          this.setState({ previewLoading: false, previewError: 'Could not load file' });
        });
    } else {
      // Demo data carries hardcoded URLs/content.
      this.setState({ previewUrl: file.docUrl || file.audioSrc || file.poster || '' });
    }
  }

  // Images in the active image's folder (for gallery prev/next), name-sorted.
  _galleryImages() {
    const st = this.state;
    const active = st.files.find((f) => f.id === st.activeFileId);
    if (!active) return [];
    return st.files
      .filter((f) => !f.trashed && f.kind === 'image' && f.parentId === active.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  previewStep(dir) {
    const list = this._galleryImages();
    const idx = list.findIndex((f) => f.id === this.state.activeFileId);
    const nextItem = list[idx + dir];
    if (nextItem) this.openFile(nextItem);
  }

  // --- Edit-in-place (text files) -------------------------------------------
  startEdit() {
    this.setState({ editing: true, editText: this.state.previewText || '' });
  }
  setEditText(e) {
    this.setState({ editText: e.target.value });
  }
  cancelEdit() {
    this.setState({ editing: false, editText: '' });
  }
  saveEdit() {
    const id = this.state.activeFileId;
    const content = this.state.editText;
    this.setState({ editSaving: true });
    api
      .updateFileContent(id, content)
      .then((f) => {
        this.setState((s) => ({
          editing: false,
          editSaving: false,
          previewText: content,
          files: s.files.map((x) =>
            x.id === id
              ? {
                  ...x,
                  size: f && f.size_bytes != null ? humanSize(f.size_bytes) : x.size,
                  sizeBytes: f ? f.size_bytes : x.sizeBytes,
                }
              : x
          ),
        }));
        this.toast('Saved');
      })
      .catch((err) => {
        this.setState({ editSaving: false });
        this.toast(firstError(err, 'Could not save'));
      });
  }

  // --- Rename (files & folders) ---------------------------------------------
  openRename(file) {
    this.closeCtxMenu();
    this.setState({
      modal: 'rename',
      renameTargetId: file.id,
      renameIsFolder: file.kind === 'folder',
      renameName: file.name,
    });
  }
  setRenameName(e) {
    this.setState({ renameName: e.target.value });
  }
  submitRename() {
    const { renameTargetId, renameIsFolder, renameName } = this.state;
    const name = (renameName || '').trim();
    if (!name) {
      this.toast('Enter a name');
      return;
    }
    const item = this.state.files.find((f) => f.id === renameTargetId);
    const applyName = (finalName) => {
      this.setState((s) => ({
        files: s.files.map((f) => (f.id === renameTargetId ? { ...f, name: finalName } : f)),
        modal: null,
      }));
      this.toast(finalName !== name ? `Renamed to "${finalName}"` : 'Renamed');
    };
    if (item && item.real) {
      const call = renameIsFolder
        ? api.updateFolder(renameTargetId, { name })
        : api.updateFile(renameTargetId, { name });
      call
        .then((r) => applyName((r && r.name) || name))
        .catch((err) => this.toast(firstError(err, 'Could not rename')));
    } else {
      applyName(name);
    }
  }

  // --- Move (files & folders) -----------------------------------------------
  openMove(file) {
    this.closeCtxMenu();
    this.setState({
      modal: 'move',
      moveTargetId: file.id,
      moveIsFolder: file.kind === 'folder',
      moveDestId: null,
    });
  }
  setMoveDest(id) {
    this.setState({ moveDestId: id });
  }
  submitMove() {
    const { moveBulk, moveDestId, selectedIds, moveTargetId } = this.state;
    if (moveBulk) {
      [...selectedIds].forEach((id) => this.doMove(id, moveDestId));
      this.setState({ modal: null, moveBulk: false, selectedIds: [] });
      return;
    }
    this.doMove(moveTargetId, moveDestId);
    this.setState({ modal: null });
  }
  // Shared move for both the Move dialog and drag-and-drop.
  doMove(id, destId) {
    const item = this.state.files.find((f) => f.id === id);
    if (!item || id === destId) return;
    if (item.parentId === destId) return; // already there
    const isFolder = item.kind === 'folder';
    if (isFolder) {
      const dest = this.state.files.find((f) => f.id === destId);
      if (destId === id || (dest && this._isDescendantOf(dest, id, this.state.files))) {
        this.toast("Can't move a folder into itself");
        return;
      }
    }
    const apply = (finalName) => {
      this.setState((s) => ({
        files: s.files.map((f) =>
          f.id === id ? { ...f, parentId: destId, name: finalName || f.name } : f
        ),
      }));
      this.toast('Moved');
    };
    if (item.real) {
      const call = isFolder
        ? api.updateFolder(id, { parent: destId })
        : api.updateFile(id, { folder: destId });
      call
        .then((r) => apply(r && r.name))
        .catch((err) => this.toast(firstError(err, 'Could not move')));
    } else {
      apply();
    }
  }

  // --- Drag-and-drop move ----------------------------------------------------
  onDragStartItem(file, e) {
    this.setState({ draggingId: file.id });
    if (e && e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', file.id);
      } catch (err) {}
    }
  }
  onDragEnd() {
    this.setState({ draggingId: null, dragOverId: null });
  }
  onDragOverFolder(folder, e) {
    const dragging = this.state.draggingId;
    if (!dragging || dragging === folder.id) return;
    // Disallow dropping a folder into its own subtree.
    if (this._isDescendantOf(folder, dragging, this.state.files)) return;
    if (e) e.preventDefault(); // allow the drop
    if (this.state.dragOverId !== folder.id) this.setState({ dragOverId: folder.id });
  }
  onDragLeaveFolder(folder) {
    if (this.state.dragOverId === folder.id) this.setState({ dragOverId: null });
  }
  onDropFolder(folder, e) {
    if (e) e.preventDefault();
    const dragging = this.state.draggingId;
    this.setState({ draggingId: null, dragOverId: null });
    if (dragging) this.doMove(dragging, folder.id);
  }

  // --- Bulk selection --------------------------------------------------------
  toggleSelect(id, e) {
    if (e) e.stopPropagation();
    this.setState((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    }));
  }
  clearSelection() {
    if (this.state.selectedIds.length) this.setState({ selectedIds: [] });
  }
  bulkTrash() {
    const ids = [...this.state.selectedIds];
    ids.forEach((id) => {
      const f = this.state.files.find((x) => x.id === id);
      if (f && f.real) {
        const call = f.kind === 'folder' ? api.deleteFolder(id) : api.deleteFile(id);
        call.catch(() => {});
      }
    });
    this.setState((s) => ({
      files: s.files.map((x) => (ids.includes(x.id) ? { ...x, trashed: true } : x)),
      selectedIds: [],
    }));
    this.toast(`Moved ${ids.length} to trash`);
  }
  bulkDownload() {
    const ids = this.state.selectedIds;
    this.state.files
      .filter((f) => ids.includes(f.id) && f.kind !== 'folder')
      .forEach((f) => this.downloadFile(f));
    this.setState({ selectedIds: [] });
  }
  openBulkMove() {
    this.setState({
      modal: 'move',
      moveBulk: true,
      moveTargetId: null,
      moveIsFolder: false,
      moveDestId: null,
    });
  }

  // --- Share-link management -------------------------------------------------
  openLinks() {
    this.setState({ modal: 'links', drawerOpen: false, linksLoading: true, linksList: [] });
    api
      .listShares()
      .then((links) => this.setState({ linksList: links || [], linksLoading: false }))
      .catch(() => this.setState({ linksLoading: false }));
  }
  revokeLink(id) {
    api.revokeShare(id).catch((err) => this.toast(firstError(err, 'Could not revoke')));
    this.setState((s) => ({ linksList: s.linksList.filter((l) => l.id !== id) }));
    this.toast('Link revoked');
  }
  copyShareUrl(url) {
    const abs = url && url.startsWith('http') ? url : window.location.origin + url;
    try {
      navigator.clipboard.writeText(abs);
    } catch (e) {}
    this.toast('Link copied');
  }
  openShare(file, e) {
    if (e) e.stopPropagation();
    this.setState({
      modal: 'share',
      activeFileId: file.id,
      shareAccess: 'restricted',
      sharePermission: 'view',
      shareEmails: [],
      shareEmailInput: '',
      shareCopied: false,
      shareLinkUrl: '',
    });
    if (file.real) {
      api
        .createShare(file.id)
        .then((link) => this.setState({ shareLinkUrl: window.location.origin + link.url }))
        .catch((err) => this.toast(firstError(err, 'Could not create link')));
    }
  }
  openShareForActive() {
    const f = this.state.files.find((x) => x.id === this.state.activeFileId);
    if (f) this.openShare(f);
  }
  downloadActive() {
    const f = this.state.files.find((x) => x.id === this.state.activeFileId);
    if (!f) return;
    if (f.real) {
      this.downloadFile(f);
      return;
    }
    const url = f.docUrl || f.audioSrc || f.poster || f.videoSrc || this.state.previewUrl;
    if (url) window.open(url, '_blank');
    this.toast('Download started');
  }
  saveToCloud() {
    this.toast('Saved to My Files');
  }
  downloadDevice() {
    this.downloadActive();
  }
  deleteActive() {
    const id = this.state.activeFileId;
    if (id) this.deleteForever(id);
  }
  toggleStar(id, e) {
    if (e) e.stopPropagation();
    this.setState((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, starred: !f.starred } : f)),
    }));
  }
  // Per-item context menu (right-click on desktop, ⋯ button anywhere).
  openCtxMenu(file, e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mw = 188,
      mh = 268,
      pad = 8;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const cx = (e && e.clientX) || pad,
      cy = (e && e.clientY) || pad;
    const x = Math.max(pad, Math.min(cx, vw - mw - pad));
    const y = Math.max(pad, Math.min(cy, vh - mh - pad));
    this.setState({ ctxMenu: { file, x, y } });
  }
  closeCtxMenu() {
    if (this.state.ctxMenu) this.setState({ ctxMenu: null });
  }
  downloadFile(file) {
    this.closeCtxMenu();
    if (!file) return;
    if (file.kind === 'folder') {
      this.openFile(file);
      return;
    }
    if (file.real) {
      api
        .fileDownload(file.id)
        .then((d) => {
          if (d && d.download_url) window.open(d.download_url, '_blank');
          this.toast('Download started');
        })
        .catch((err) => this.toast(firstError(err, 'Could not download')));
      return;
    }
    const url = file.docUrl || file.audioSrc || file.videoSrc || file.poster;
    if (url) window.open(url, '_blank');
    this.toast('Download started');
  }
  ctxAction(fn) {
    this.closeCtxMenu();
    if (fn) fn();
  }
  restoreFile(id, e) {
    if (e) e.stopPropagation();
    const f = this.state.files.find((x) => x.id === id);
    this.setState((s) => ({
      files: s.files.map((x) => (x.id === id ? { ...x, trashed: false } : x)),
    }));
    if (f && f.real) {
      // Folders and files have separate restore endpoints; the server may hand
      // back a de-duped name if the old name was reused while it was trashed.
      const call = f.kind === 'folder' ? api.restoreFolder(id) : api.restoreFile(id);
      call
        .then((r) => {
          if (r && r.name)
            this.setState((s) => ({
              files: s.files.map((x) => (x.id === id ? { ...x, name: r.name } : x)),
            }));
        })
        .catch(() => {});
    }
    this.toast('Restored');
  }
  // Walk `item` up its parentId chain; true if `ancestorId` is above it.
  _isDescendantOf(item, ancestorId, files) {
    let pid = item.parentId;
    const seen = new Set();
    while (pid && !seen.has(pid)) {
      if (pid === ancestorId) return true;
      seen.add(pid);
      const parent = files.find((x) => x.id === pid);
      pid = parent ? parent.parentId : null;
    }
    return false;
  }
  deleteForever(id, e) {
    if (e) e.stopPropagation();
    const f = this.state.files.find((x) => x.id === id);
    if (!f) return;
    const isFolder = f.kind === 'folder';
    if (f.trashed) {
      // Permanent purge from trash. Folders purge their whole subtree server-side.
      if (f.real) {
        const call = isFolder ? api.purgeFolder(id) : api.purgeFile(id);
        call.catch(() => {});
      }
      this.setState((s) => ({
        // Drop the item and, for a folder, any of its descendants still in state.
        files: s.files.filter(
          (x) => x.id !== id && (!isFolder || !this._isDescendantOf(x, id, s.files))
        ),
        modal: null,
      }));
      this.toast('Deleted permanently');
    } else {
      // Soft delete: move to trash (still counts toward quota until purged).
      if (f.real) {
        const call = isFolder ? api.deleteFolder(id) : api.deleteFile(id);
        call.catch((err) => this.toast(firstError(err, 'Could not delete')));
      }
      this.setState((s) => ({
        files: s.files.map((x) => (x.id === id ? { ...x, trashed: true } : x)),
        modal: null,
      }));
      this.toast('Moved to trash');
    }
  }
  emptyTrash() {
    // Permanently purge real trashed items server-side (releasing quota) — not
    // just hiding them locally, which left them on the server to reappear on the
    // next reload. Demo-only items are dropped from local state.
    const trashed = this.state.files.filter((f) => f.trashed);
    const real = trashed.filter((f) => f.real);
    if (real.length) {
      Promise.all(
        real.map((f) =>
          (f.kind === 'folder' ? api.purgeFolder(f.id) : api.purgeFile(f.id)).catch(() => {})
        )
      ).then(() => {
        this.loadStorage();
        this.loadUsage();
      });
    }
    this.setState((s) => ({ files: s.files.filter((f) => !f.trashed) }));
    this.toast('Trash emptied');
  }
  addUsage(gb) {
    this.setState((s) => ({ usedGB: Math.min(5, Math.round((s.usedGB + gb) * 100) / 100) }));
  }
  fileInputRef(el) {
    this._fileInput = el;
  }
  browseFiles() {
    if (this._fileInput) this._fileInput.click();
  }
  onFilesPicked(e) {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    list.forEach((f) => this.realUpload(f));
    e.target.value = '';
  }

  // Real upload: reserve quota -> PUT bytes to the presigned URL -> commit/dedup.
  realUpload(f) {
    const kind = kindOf(f.type || '');
    const qid = 'up-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const cur = this.state.currentFolderId;
    const inFolder = typeof cur === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(cur);
    this.setState((s) => ({
      uploadQueue: [...s.uploadQueue, { id: qid, name: f.name, progress: 15 }],
      modal: null,
    }));
    api
      .initiateUpload({
        name: f.name,
        size_bytes: f.size,
        kind,
        ...(inFolder ? { folder: cur } : {}),
      })
      .then((res) => api.uploadBytes(res.upload.url, f).then(() => api.completeUpload(res.file.id)))
      .then((file) => {
        const nf = {
          id: file.id,
          name: file.name,
          kind: file.kind,
          parentId: file.folder || null,
          size: humanSize(file.size_bytes),
          sizeBytes: file.size_bytes,
          modified: 'Just now',
          shared: false,
          starred: false,
          trashed: false,
          status: file.status,
          poster: file.poster_url || undefined,
          duration: fmtDuration(file.duration_seconds) || undefined,
          real: true,
        };
        this.setState((s) => ({
          files: [nf, ...s.files.filter((x) => x.id !== qid)],
          uploadQueue: s.uploadQueue.filter((u) => u.id !== qid),
        }));
        this.toast(file.status === 'processing' ? 'Uploaded — processing video…' : 'Uploaded');
        // A video may still be transcoding; refresh shortly to pick up its
        // poster + ready state (prod worker; instant in dev).
        if (file.kind === 'video' && file.status === 'processing') {
          setTimeout(() => this.refreshFile(file.id), 2500);
        }
      })
      .catch((err) => {
        this.setState((s) => ({ uploadQueue: s.uploadQueue.filter((u) => u.id !== qid) }));
        this.toast(firstError(err, 'Upload failed'));
      });
  }

  simulateUpload() {
    const P = (s) => `https://picsum.photos/seed/${s}/640/420`;
    const specs = [
      {
        name: 'sunset-clip.mp4',
        kind: 'video',
        poster: P('sunset' + Date.now()),
        videoSrc: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        duration: '0:15',
      },
      {
        name: 'contract-final.pdf',
        kind: 'doc',
        docUrl: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
      },
    ];
    const items = specs.map((n, i) => ({ ...n, id: 'up-' + Date.now() + '-' + i, progress: 0 }));
    this.setState((s) => ({
      uploadQueue: [
        ...s.uploadQueue,
        ...items.map((it) => ({ id: it.id, name: it.name, progress: 0 })),
      ],
    }));
    items.forEach((item) => {
      const timer = setInterval(() => {
        this.setState((s) => {
          const q = s.uploadQueue.map((u) =>
            u.id === item.id
              ? { ...u, progress: Math.min(100, u.progress + Math.round(10 + Math.random() * 20)) }
              : u
          );
          const done = q.find((u) => u.id === item.id && u.progress >= 100);
          if (done) {
            clearInterval(timer);
            const nf = {
              id: item.id,
              name: item.name,
              kind: item.kind,
              parentId: s.currentFolderId,
              size: item.kind === 'video' ? '128 MB' : '1.4 MB',
              modified: 'Just now',
              duration: item.duration || null,
              poster: item.poster,
              videoSrc: item.videoSrc,
              docUrl: item.docUrl,
              watchedPct: 0,
              shared: false,
              starred: false,
              trashed: false,
              recentRank: 0,
            };
            setTimeout(() => {
              this.setState((s2) => ({
                files: [nf, ...s2.files],
                uploadQueue: s2.uploadQueue.filter((u) => u.id !== item.id),
              }));
              this.addUsage(item.kind === 'video' ? 0.13 : 0.01);
            }, 500);
          }
          return { uploadQueue: q };
        });
      }, 350);
    });
  }

  audioRef(el) {
    if (el && this._activeAudioSrc && el.src !== this._activeAudioSrc)
      el.src = this._activeAudioSrc;
  }
  videoRef(el) {
    this._videoEl = el;
    if (el) {
      if (this._activePoster) el.poster = this._activePoster;
      if (this._activeVideoSrc && el.src !== this._activeVideoSrc) {
        el.src = this._activeVideoSrc;
        el.load();
      }
    }
    if (el && !el._wired) {
      el._wired = true;
      el.addEventListener('timeupdate', () => {
        const dur = el.duration || 0;
        this.setState({
          videoCurrent: el.currentTime,
          videoDuration: dur,
          videoProgress: dur ? (el.currentTime / dur) * 100 : 0,
        });
      });
      el.addEventListener('loadedmetadata', () =>
        this.setState({ videoDuration: el.duration || 0 })
      );
      el.addEventListener('play', () => this.setState({ videoPlaying: true }));
      el.addEventListener('pause', () => this.setState({ videoPlaying: false }));
      el.addEventListener('ended', () => this.setState({ videoPlaying: false }));
      el.addEventListener('waiting', () => this.setState({ videoLoading: true }));
      el.addEventListener('playing', () => this.setState({ videoLoading: false }));
      el.addEventListener('canplay', () => this.setState({ videoLoading: false }));
      el.addEventListener('loadstart', () => this.setState({ videoLoading: true }));
      el.addEventListener('error', () => this.setState({ videoLoading: false }));
    }
    if (el) {
      el.volume = this.state.videoVolume;
      el.playbackRate = this.state.videoRate;
    }
  }
  setVolume(e) {
    const v = parseFloat(e.target.value);
    if (this._videoEl) {
      this._videoEl.volume = v;
      this._videoEl.muted = v === 0;
    }
    this.setState({ videoVolume: v, videoMuted: v === 0 });
  }
  cycleRate() {
    const rates = [1, 1.25, 1.5, 2, 0.5];
    const cur = this.state.videoRate;
    const next = rates[(rates.indexOf(cur) + 1) % rates.length];
    if (this._videoEl) this._videoEl.playbackRate = next;
    this.setState({ videoRate: next });
  }
  toggleVideoPlay() {
    if (this._videoEl) {
      if (this._videoEl.paused) this._videoEl.play();
      else this._videoEl.pause();
    }
  }
  scrubVideo(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (this._videoEl && this._videoEl.duration)
      this._videoEl.currentTime = pct * this._videoEl.duration;
    else this.setState({ videoProgress: pct * 100 });
  }
  toggleTheater() {
    const next = !this.state.videoFullscreen;
    this.setState({ videoFullscreen: next });
    try {
      if (next && this._videoEl && this._videoEl.requestFullscreen)
        this._videoEl.requestFullscreen();
      else if (!next && document.fullscreenElement) document.exitFullscreen();
    } catch (e) {}
  }

  toggleCC() {
    this.setState((s) => ({ videoCC: !s.videoCC }));
  }
  toggleMute() {
    if (this._videoEl) this._videoEl.muted = !this._videoEl.muted;
    this.setState((s) => ({ videoMuted: !s.videoMuted }));
  }

  copyLink() {
    const url = this.state.shareLinkUrl;
    if (url && navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    this.setState({ shareCopied: true });
    this.toast(url ? 'Link copied to clipboard' : 'Link ready');
    setTimeout(() => this.setState({ shareCopied: false }), 1500);
  }
  setAccessRestricted() {
    this.setState({ shareAccess: 'restricted' });
  }
  setAccessAnyone() {
    this.setState({ shareAccess: 'anyone' });
  }
  setPermView() {
    this.setState({ sharePermission: 'view' });
  }
  setPermEdit() {
    this.setState({ sharePermission: 'edit' });
  }
  setEmailInput(e) {
    this.setState({ shareEmailInput: e.target.value });
  }
  addEmail(e) {
    if (e.key === 'Enter' && this.state.shareEmailInput.trim())
      this.setState((s) => ({
        shareEmails: [...s.shareEmails, s.shareEmailInput.trim()],
        shareEmailInput: '',
      }));
  }
  removeEmail(email) {
    this.setState((s) => ({ shareEmails: s.shareEmails.filter((e) => e !== email) }));
  }

  fmt(t) {
    t = Math.floor(t || 0);
    const m = Math.floor(t / 60);
    const s = t % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  // Destination folders for the Move dialog: "My Files" (root) + every folder,
  // indented by depth, excluding the item being moved and (for a folder) its
  // own subtree — those would create a cycle.
  moveDestOptions() {
    const { files, moveTargetId, moveIsFolder, moveBulk, selectedIds } = this.state;
    const excluded = new Set();
    const excludeSubtree = (fid) => {
      excluded.add(fid);
      files.forEach((f) => {
        if (f.kind === 'folder' && !f.trashed && f.parentId === fid) excludeSubtree(f.id);
      });
    };
    if (moveBulk) {
      selectedIds.forEach((id) => {
        const f = files.find((x) => x.id === id);
        if (f && f.kind === 'folder') excludeSubtree(id);
        else excluded.add(id);
      });
    } else if (moveTargetId) {
      excluded.add(moveTargetId);
      if (moveIsFolder) excludeSubtree(moveTargetId);
    }
    const opts = [{ id: null, name: 'My Files', depth: 0 }];
    const walk = (parentId, depth) => {
      files
        .filter(
          (f) => f.kind === 'folder' && !f.trashed && f.parentId === parentId && !excluded.has(f.id)
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((f) => {
          opts.push({ id: f.id, name: f.name, depth });
          walk(f.id, depth + 1);
        });
    };
    walk(null, 1);
    return opts;
  }

  renderVals() {
    const st = this.state;
    const {
      files,
      authView,
      deviceMode,
      currentFolderId,
      filterKey,
      searchQuery,
      mobileSearchOpen,
      drawerOpen,
      modal,
      activeFileId,
      settingsTab,
      emailVerified,
      twofa,
      uploadQueue,
      shareAccess,
      sharePermission,
      shareEmails,
      shareEmailInput,
      shareCopied,
      shareLinkUrl,
      videoPlaying,
      videoProgress,
      videoCurrent,
      videoDuration,
      videoMuted,
      videoCC,
      videoFullscreen,
      toastMsg,
      discoverResults,
    } = st;
    const isMobile = (st.vw || 1200) < 820;
    const isApp = authView === 'app';
    const q = searchQuery.trim().toLowerCase();
    const searchActive = q.length > 0;
    const nonTrashed = files.filter((f) => !f.trashed);

    const mkImgRef = (url) => (el) => {
      if (!el) return;
      // Hide a failed image so the parent's neutral background shows through,
      // instead of the browser's broken-image glyph.
      el.onerror = () => {
        el.style.visibility = 'hidden';
      };
      el.onload = () => {
        el.style.visibility = 'visible';
      };
      if (url && el.src !== url) el.src = url;
    };
    const decorate = (f) => {
      const isFolder = f.kind === 'folder',
        isImage = f.kind === 'image',
        isVideo = f.kind === 'video',
        isDoc = f.kind === 'doc',
        isAudio = f.kind === 'audio';
      const itemCount = isFolder
        ? files.filter((x) => x.parentId === f.id && !x.trashed).length
        : 0;
      const daysLeft = f.trashed ? Math.max(0, 30 - (f.deletedDaysAgo || 0)) : null;
      return {
        ...f,
        isFolder,
        isImage,
        isVideo,
        isDoc,
        isAudio,
        showThumb: isImage || isVideo,
        isDocOrAudio: isDoc || isAudio,
        isTrashed: !!f.trashed,
        isProcessing: f.status === 'processing',
        tileBg: isDoc ? theme.dangerBgSoft : theme.tealBg,
        starFill: f.starred ? theme.star : 'none',
        starStroke: f.starred ? theme.star : theme.textFaint,
        metaLine: isFolder
          ? itemCount + (itemCount === 1 ? ' item' : ' items')
          : `${f.size || ''}${f.size && f.modified ? ' · ' : ''}${f.modified || ''}`,
        retentionLabel:
          daysLeft !== null ? daysLeft + (daysLeft === 1 ? ' day left' : ' days left') : '',
        channelLine: 'Uploaded by you',
        shareUrl: 'floppy.disk/s/' + f.id,
        imgRef: mkImgRef(f.poster),
        onOpen: () => this.openFile(f),
        onShare: (e) => this.openShare(f, e),
        onToggleStar: (e) => this.toggleStar(f.id, e),
        onRestore: (e) => this.restoreFile(f.id, e),
        onDeleteForever: (e) => this.deleteForever(f.id, e),
        onCtxMenu: (e) => this.openCtxMenu(f, e),
        onDownload: () => this.downloadFile(f),
        // Drag-and-drop move: any non-trashed item drags; folders are drop targets.
        draggable: !f.trashed,
        onDragStart: (e) => this.onDragStartItem(f, e),
        onDragEnd: () => this.onDragEnd(),
        isDropTarget: isFolder && !f.trashed,
        isDragOver: st.dragOverId === f.id,
        onDragOver: (e) => this.onDragOverFolder(f, e),
        onDragLeave: () => this.onDragLeaveFolder(f),
        onDrop: (e) => this.onDropFolder(f, e),
        // Bulk selection.
        selectable: !f.trashed,
        selected: st.selectedIds.includes(f.id),
        onToggleSelect: (e) => this.toggleSelect(f.id, e),
      };
    };

    // Sort comparator (folders always first, then the chosen key).
    const folderFirst = (a, b) => (a.kind === 'folder' ? 0 : 1) - (b.kind === 'folder' ? 0 : 1);
    const byKey =
      st.sortBy === 'size'
        ? (a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0) || a.name.localeCompare(b.name)
        : (a, b) => a.name.localeCompare(b.name);
    const sortListing = (list) => list.sort((a, b) => folderFirst(a, b) || byKey(a, b));

    let rawList,
      sectionTitle,
      currentFolderName = null,
      showBreadcrumb = false;
    if (searchActive) {
      const local = nonTrashed.filter((f) => f.name.toLowerCase().includes(q));
      const localIds = new Set(local.map((f) => f.id));
      const extra = (discoverResults || []).filter((r) => !localIds.has(r.id));
      let results = [...local, ...extra];
      if (st.searchType !== 'all') {
        results = results.filter((f) =>
          st.searchType === 'folder' ? f.kind === 'folder' : f.kind === st.searchType
        );
      }
      rawList = sortListing(results);
      sectionTitle = 'Results for "' + searchQuery.trim() + '"';
    } else if (filterKey === 'all') {
      rawList = nonTrashed.filter((f) => f.parentId === currentFolderId);
      const cf = currentFolderId ? files.find((f) => f.id === currentFolderId) : null;
      currentFolderName = cf ? cf.name : null;
      sectionTitle = currentFolderName || 'My Files';
      showBreadcrumb = true;
      sortListing(rawList);
    } else if (filterKey === 'shared') {
      rawList = sortListing(nonTrashed.filter((f) => f.shared));
      sectionTitle = 'Shared with me';
    } else if (filterKey === 'recent') {
      rawList = nonTrashed
        .filter((f) => f.kind !== 'folder')
        .sort((a, b) => (a.recentRank || 99) - (b.recentRank || 99))
        .slice(0, 8);
      sectionTitle = 'Recent';
    } else {
      rawList = files.filter((f) => f.trashed);
      sectionTitle = 'Trash';
    }

    const visibleFiles = rawList.map(decorate);
    const isEmpty = visibleFiles.length === 0;
    const emptyMessage = searchActive
      ? 'No files match your search'
      : filterKey === 'all' && currentFolderId
        ? 'This folder is empty'
        : filterKey === 'trash'
          ? 'Trash is empty'
          : filterKey === 'shared'
            ? 'Nothing shared yet'
            : 'No files yet';
    const isHome = !searchActive && filterKey === 'all' && !currentFolderId;
    const showCarousel = isHome && !isEmpty;

    const carouselItems = nonTrashed
      .filter((f) => f.kind === 'video')
      .map((f) => ({
        title: f.name,
        poster: f.poster,
        duration: f.duration,
        watchedPct: f.watchedPct || 0,
        imgRef: mkImgRef(f.poster),
        onOpen: () => this.openFile(f),
      }));

    const activeRaw = activeFileId ? files.find((f) => f.id === activeFileId) : null;
    const activeFile = activeRaw ? decorate(activeRaw) : null;

    const navColor = (a) => (a ? theme.brand : theme.textMuted);
    const navBg = (a) => (a ? theme.brandBg : 'transparent');
    const navW = (a) => (a ? 600 : 500);
    const af = (k) => !searchActive && filterKey === k;
    const _realTotalGB = st.realQuotaBytes != null ? st.realQuotaBytes / 1073741824 : null;
    const _realUsedGB = st.realUsedBytes != null ? st.realUsedBytes / 1073741824 : null;
    const storageTotalGB = _realTotalGB != null ? _realTotalGB : 5;
    const storageUsedGB = _realUsedGB != null ? _realUsedGB : st.usedGB;
    const storagePct =
      storageTotalGB > 0 ? Math.min(100, Math.round((storageUsedGB / storageTotalGB) * 100)) : 0;
    // Context-menu items for the right-clicked / ⋯-tapped tile.
    let ctxMenuView = null;
    if (st.ctxMenu) {
      const f = st.ctxMenu.file,
        items = [];
      if (f.trashed) {
        items.push({ label: 'Restore', fn: () => this.restoreFile(f.id) });
        items.push({
          label: 'Delete permanently',
          danger: true,
          fn: () => this.deleteForever(f.id),
        });
      } else {
        items.push({ label: 'Open', fn: () => this.openFile(f) });
        if (f.kind !== 'folder') items.push({ label: 'Download', fn: () => this.downloadFile(f) });
        items.push({ label: 'Rename', fn: () => this.openRename(f) });
        items.push({ label: 'Move to…', fn: () => this.openMove(f) });
        items.push({ label: f.starred ? 'Unstar' : 'Star', fn: () => this.toggleStar(f.id) });
        items.push({ label: 'Share link', fn: () => this.openShare(f) });
        items.push({ label: 'Move to trash', danger: true, fn: () => this.deleteForever(f.id) });
      }
      ctxMenuView = { x: st.ctxMenu.x, y: st.ctxMenu.y, name: f.name, items };
    }
    const seg = (on) => ({
      bg: on ? theme.brandBg : theme.white,
      color: on ? theme.brand : theme.textMuted,
      border: on ? theme.brandBorder : theme.border,
    });
    const rA = seg(shareAccess === 'restricted'),
      aA = seg(shareAccess === 'anyone'),
      vP = seg(sharePermission === 'view'),
      eP = seg(sharePermission === 'edit');

    const d = isMobile
      ? {
          isMobile: true,
          pad: 16,
          padBottom: 82,
          gridMin: 150,
          cardGap: 12,
          thumbH: 96,
          carouselW: 176,
          carouselH: 104,
          modalAlign: 'flex-end',
          modalPad: 0,
          modalW: '100%',
          modalRadius: '22px 22px 0 0',
          modalMaxH: '90vh',
        }
      : {
          isMobile: false,
          pad: 26,
          padBottom: 26,
          gridMin: 168,
          cardGap: 16,
          thumbH: 128,
          carouselW: 236,
          carouselH: 132,
          modalAlign: 'center',
          modalPad: 24,
          modalW: '480px',
          modalRadius: '18px',
          modalMaxH: '86vh',
        };
    const theater = modal === 'video' && videoFullscreen;
    const authTitles = {
      login: 'Welcome back',
      register: 'Create your account',
      forgot: 'Reset password',
    };
    const authSubs = {
      login: 'Sign in to your Floppy Disk account',
      register: 'Create a Floppy Disk account',
      forgot: 'Enter your email and we\u2019ll send a reset link',
    };

    return {
      d,
      isMobile,
      isDesktop: !isMobile,
      isApp,
      isAuth: !isApp,
      urlPath: !isApp ? (authView === 'register' ? 'signup' : 'login') : 'files',
      authTitle: authTitles[authView] || 'Floppy Disk',
      authSubtitle: authSubs[authView] || '',
      authIsLogin: authView === 'login',
      // Demo credentials hint only in dev builds, never in production.
      showDemoCreds: !!(import.meta && import.meta.env && import.meta.env.DEV),
      authIsRegister: authView === 'register',
      authIsForgot: authView === 'forgot',
      authNeedsEmail: authView === 'login' || authView === 'register' || authView === 'forgot',
      authNeedsPassword: authView === 'login' || authView === 'register',
      authName: st.authName,
      authEmail: st.authEmail,
      authPassword: st.authPassword,
      authDob: st.authDob,
      authBusy: st.authBusy,
      setAuthName: (e) => this.setAuthName(e),
      setAuthEmail: (e) => this.setAuthEmail(e),
      setAuthPassword: (e) => this.setAuthPassword(e),
      setAuthDob: (e) => this.setAuthDob(e),
      authPrimary: () => this.authPrimary(),
      authPrimaryLabel:
        {
          login: 'Sign in',
          register: 'Create account',
          forgot: 'Send reset link',
        }[authView] || 'Continue',
      gotoRegister: () => this.gotoRegister(),
      gotoLogin: () => this.gotoLogin(),
      logout: () => this.logout(),
      toastForgot: () => this.toastForgot(),
      setDesktop: () => this.setDesktop(),
      setMobile: () => this.setMobile(),
      deskTabBg: isMobile ? 'transparent' : '#5145E5',
      deskTabColor: isMobile ? '#656B76' : '#fff',
      mobTabBg: isMobile ? '#5145E5' : 'transparent',
      mobTabColor: isMobile ? '#fff' : '#656B76',
      searchQuery,
      setSearch: (e) => this.setSearch(e),
      clearSearch: () => this.clearSearch(),
      searchActive,
      showMobileSearch: isMobile && mobileSearchOpen,
      toggleMobileSearch: () => this.toggleMobileSearch(),
      drawerOpen,
      openDrawer: () => this.openDrawer(),
      closeDrawer: () => this.closeDrawer(),
      stop: (e) => this.stop(e),
      openSettings: () => this.openSettings(),
      visibleFiles,
      hasFiles: !isEmpty,
      isEmpty,
      emptyMessage,
      sectionTitle,
      showBreadcrumb,
      showFolderCrumb: !!currentFolderName,
      showSectionTitleOnly: !showBreadcrumb,
      currentFolderName,
      breadcrumbCrumbs: (() => {
        const chain = [];
        let id = currentFolderId;
        while (id) {
          const f = files.find((x) => x.id === id);
          if (!f) break;
          chain.unshift({ name: f.name, onClick: () => this.navToFolder(f.id) });
          id = f.parentId;
        }
        return chain;
      })(),
      navToFolder: (id) => this.navToFolder(id),
      isTrashView: af('trash'),
      crumbRootColor: currentFolderName ? '#9AA1AC' : '#15171C',
      showCarousel,
      carouselItems,
      showGridLabel: showCarousel,
      gridLabel: 'Files & folders',
      // Bulk selection.
      selectionActive: st.selectedIds.length > 0,
      selectionCount: st.selectedIds.length,
      onClearSelection: () => this.clearSelection(),
      onBulkMove: () => this.openBulkMove(),
      onBulkDownload: () => this.bulkDownload(),
      onBulkTrash: () => this.bulkTrash(),
      // Search type filters (shown while searching).
      showSearchFilters: searchActive,
      searchTypeChips: [
        { label: 'All', key: 'all' },
        { label: 'Folders', key: 'folder' },
        { label: 'Images', key: 'image' },
        { label: 'Videos', key: 'video' },
        { label: 'Docs', key: 'doc' },
        { label: 'Audio', key: 'audio' },
      ].map((c) => ({
        ...c,
        active: st.searchType === c.key,
        onClick: () => this.setSearchType(c.key),
      })),
      // Sort + view controls (shown above a non-trash listing that has items).
      showListToolbar: !isEmpty && !af('trash'),
      sortByName: st.sortBy === 'name',
      sortBySize: st.sortBy === 'size',
      setSortName: () => this.setSortBy('name'),
      setSortSize: () => this.setSortBy('size'),
      isGridView: st.viewMode === 'grid',
      isListView: st.viewMode === 'list',
      setGridView: () => this.setViewMode('grid'),
      setListView: () => this.setViewMode('list'),
      sharedCount: nonTrashed.filter((f) => f.shared).length,
      trashCount: files.filter((f) => f.trashed).length,
      navToAll: () => this.navToAll(),
      navToShared: () => this.navToShared(),
      navToRecent: () => this.navToRecent(),
      navToTrash: () => this.navToTrash(),
      navAllBg: navBg(af('all')),
      navAllColor: navColor(af('all')),
      navAllWeight: navW(af('all')),
      navSharedBg: navBg(af('shared')),
      navSharedColor: navColor(af('shared')),
      navSharedWeight: navW(af('shared')),
      navRecentBg: navBg(af('recent')),
      navRecentColor: navColor(af('recent')),
      navRecentWeight: navW(af('recent')),
      navTrashBg: navBg(af('trash')),
      navTrashColor: navColor(af('trash')),
      navTrashWeight: navW(af('trash')),
      storageUsedLabel: fmtStorage(storageUsedGB),
      storageTotalLabel: fmtStorage(storageTotalGB),
      storagePct,
      storageBarColor: storagePct > 90 ? '#E5484D' : storagePct > 75 ? '#D97706' : '#5145E5',
      ctxMenuView,
      closeCtxMenu: () => this.closeCtxMenu(),
      openUpload: () => this.openUpload(),
      openNewFolder: () => this.openNewFolder(),
      isNewFolderModal: modal === 'newFolder',
      newFolderName: st.newFolderName,
      setNewFolderName: (e) => this.setNewFolderName(e),
      createFolder: () => this.createFolder(),
      gotoForgot: () => this.gotoForgot(),
      authError: st.authError,
      hasAuthError: !!st.authError,
      fileInputRef: (el) => this.fileInputRef(el),
      browseFiles: () => this.browseFiles(),
      onFilesPicked: (e) => this.onFilesPicked(e),
      emptyTrash: () => this.emptyTrash(),
      videoVolume: st.videoVolume,
      setVolume: (e) => this.setVolume(e),
      videoRate: st.videoRate,
      rateLabel: st.videoRate + '×',
      cycleRate: () => this.cycleRate(),
      videoLoading: st.videoLoading,
      modalOpen: !!modal,
      isUploadModal: modal === 'upload',
      isSettingsModal: modal === 'settings',
      isPreviewModal: modal === 'preview',
      isVideoModal: modal === 'video',
      isShareModal: modal === 'share',
      // Share-link management.
      isLinksModal: modal === 'links',
      openLinks: () => this.openLinks(),
      linksLoading: st.linksLoading,
      linksEmpty: !st.linksLoading && (st.linksList || []).length === 0,
      linksView: (st.linksList || []).map((l) => ({
        id: l.id,
        name: l.target_name || 'Shared item',
        url: l.url && l.url.startsWith('http') ? l.url : window.location.origin + (l.url || ''),
        hasPassword: !!l.has_password,
        expiresLabel: l.expires_at ? new Date(l.expires_at).toLocaleDateString() : '',
        onCopy: () => this.copyShareUrl(l.url),
        onRevoke: () => this.revokeLink(l.id),
      })),
      // Preview viewers (image / pdf / audio / markdown / json / yaml / text).
      previewKind: st.previewKind,
      previewUrl: st.previewUrl,
      previewText: st.previewText,
      // Image gallery navigation (prev/next among images in the same folder).
      ...(() => {
        if (st.previewKind !== 'image' || !activeFile) return {};
        const imgs = files
          .filter((f) => !f.trashed && f.kind === 'image' && f.parentId === activeFile.parentId)
          .sort((a, b) => a.name.localeCompare(b.name));
        const idx = imgs.findIndex((f) => f.id === activeFileId);
        return {
          previewHasPrev: idx > 0,
          previewHasNext: idx >= 0 && idx < imgs.length - 1,
          previewCounter: imgs.length > 1 ? `${idx + 1} / ${imgs.length}` : '',
        };
      })(),
      previewPrev: () => this.previewStep(-1),
      previewNext: () => this.previewStep(1),
      // Edit-in-place (text formats, real files only).
      canEdit:
        !!activeFile &&
        !!activeFile.real &&
        ['markdown', 'json', 'yaml', 'text'].includes(st.previewKind) &&
        !st.previewLoading &&
        !st.previewError,
      isEditing: st.editing,
      editText: st.editText,
      editSaving: st.editSaving,
      onStartEdit: () => this.startEdit(),
      setEditText: (e) => this.setEditText(e),
      onCancelEdit: () => this.cancelEdit(),
      onSaveEdit: () => this.saveEdit(),
      previewLoading: st.previewLoading,
      previewError: st.previewError,
      previewHtml: st.previewKind === 'markdown' ? renderMarkdown(st.previewText || '') : '',
      previewCode:
        st.previewKind === 'json'
          ? (() => {
              try {
                return JSON.stringify(JSON.parse(st.previewText || 'null'), null, 2);
              } catch {
                return st.previewText || '';
              }
            })()
          : st.previewText || '',
      // Rename dialog.
      isRenameModal: modal === 'rename',
      renameName: st.renameName,
      renameIsFolder: st.renameIsFolder,
      setRenameName: (e) => this.setRenameName(e),
      submitRename: () => this.submitRename(),
      // Move dialog.
      isMoveModal: modal === 'move',
      moveIsFolder: st.moveIsFolder,
      moveDestId: st.moveDestId,
      setMoveDest: (id) => this.setMoveDest(id),
      submitMove: () => this.submitMove(),
      moveTargetName: st.moveBulk
        ? `${st.selectedIds.length} item${st.selectedIds.length === 1 ? '' : 's'}`
        : (st.files.find((f) => f.id === st.moveTargetId) || {}).name || '',
      moveDestOptions: this.moveDestOptions().map((o) => ({
        ...o,
        active: o.id === st.moveDestId,
      })),
      closeModal: () => this.closeModal(),
      simulateUpload: () => this.simulateUpload(),
      uploadQueueView: uploadQueue.map((u) => ({ name: u.name, progress: u.progress })),
      settingsTab,
      stIsProfile: settingsTab === 'profile',
      stIsAccount: settingsTab === 'account',
      stIsSecurity: settingsTab === 'security',
      setSettingsProfile: () => this.setSettingsProfile(),
      setSettingsAccount: () => this.setSettingsAccount(),
      setSettingsSecurity: () => this.setSettingsSecurity(),
      stProfileBg: settingsTab === 'profile' ? '#FFFFFF' : 'transparent',
      stProfileColor: settingsTab === 'profile' ? '#15171C' : '#656B76',
      stAccountBg: settingsTab === 'account' ? '#FFFFFF' : 'transparent',
      stAccountColor: settingsTab === 'account' ? '#15171C' : '#656B76',
      stSecurityBg: settingsTab === 'security' ? '#FFFFFF' : 'transparent',
      stSecurityColor: settingsTab === 'security' ? '#15171C' : '#656B76',
      profileName: st.profileName,
      profileUsername: st.profileUsername,
      profileBio: st.profileBio,
      setProfileName: (e) => this.setProfileName(e),
      setProfileUsername: (e) => this.setProfileUsername(e),
      setProfileBio: (e) => this.setProfileBio(e),
      saveProfile: () => this.saveProfile(),
      toastPhoto: () => this.toastPhoto(),
      accountEmail: st.accountEmail,
      emailVerified,
      emailNotVerified: !emailVerified,
      resendVerification: () => this.resendVerification(),
      toastDelete: () => this.toastDelete(),
      pwCurrent: st.pwCurrent,
      pwNew: st.pwNew,
      pwConfirm: st.pwConfirm,
      setPwCurrent: (e) => this.setPwCurrent(e),
      setPwNew: (e) => this.setPwNew(e),
      setPwConfirm: (e) => this.setPwConfirm(e),
      updatePassword: () => this.updatePassword(),
      twofaBg: twofa ? '#5145E5' : '#CBD0D8',
      twofaX: twofa ? 20 : 2,
      toggle2fa: () => this.toggle2fa(),
      toastSessions: () => this.toastSessions(),
      activeFile,
      openShareForActive: () => this.openShareForActive(),
      downloadActive: () => this.downloadActive(),
      deleteActive: () => this.deleteActive(),
      saveToCloud: () => this.saveToCloud(),
      downloadDevice: () => this.downloadDevice(),
      audioRef: (el) => this.audioRef(el),
      videoRef: (el) => this.videoRef(el),
      posterRef: (el) => {
        if (el && activeFile && activeFile.poster && el.src !== activeFile.poster)
          el.src = activeFile.poster;
      },
      videoPlaying,
      videoNotPlaying: !videoPlaying,
      videoProgress,
      videoTimeLabel: this.fmt(videoCurrent) + ' / ' + this.fmt(videoDuration),
      videoMuted,
      toggleVideoPlay: () => this.toggleVideoPlay(),
      scrubVideo: (e) => this.scrubVideo(e),
      toggleMute: () => this.toggleMute(),
      toggleCC: () => this.toggleCC(),
      toggleTheater: () => this.toggleTheater(),
      videoFullscreen,
      videoNotFullscreen: !videoFullscreen,
      volumeColor: videoMuted ? '#E5484D' : theater ? '#fff' : '#15171C',
      ccColor: videoCC ? (theater ? '#B9B2FF' : '#5145E5') : '#9AA1AC',
      ccBorder: videoCC ? '#C7C3F5' : theater ? '#3A3D44' : '#E5E7EC',
      overlayBg: theater ? 'rgba(8,9,12,0.92)' : 'rgba(20,23,28,0.42)',
      overlayAlign: theater ? 'stretch' : d.modalAlign,
      overlayPad: theater ? 0 : d.modalPad,
      boxW: theater ? '100%' : d.modalW,
      boxMaxH: theater ? '100vh' : d.modalMaxH,
      boxBg: theater ? '#0B0C0F' : '#FFFFFF',
      boxBorder: theater ? 'none' : '1px solid #E5E7EC',
      boxRadius: theater ? '0px' : d.modalRadius,
      boxPad: theater ? 18 : 20,
      vTextColor: theater ? '#fff' : '#15171C',
      vMutedColor: '#9AA1AC',
      vTrackBg: theater ? '#2A2D34' : '#E5E7EC',
      sdBg: theater ? '#1A1C22' : '#EEF0F4',
      sdBorder: theater ? '#3A3D44' : '#E5E7EC',
      vVideoMaxH: theater ? '78vh' : '300px',
      vVideoFlex: theater ? '1' : '0 0 auto',
      copyLink: () => this.copyLink(),
      shareLinkUrl: st.shareLinkUrl,
      copyLabel: shareCopied ? 'Copied!' : 'Copy',
      setAccessRestricted: () => this.setAccessRestricted(),
      setAccessAnyone: () => this.setAccessAnyone(),
      restrictedBg: rA.bg,
      restrictedColor: rA.color,
      restrictedBorder: rA.border,
      anyoneBg: aA.bg,
      anyoneColor: aA.color,
      anyoneBorder: aA.border,
      setPermView: () => this.setPermView(),
      setPermEdit: () => this.setPermEdit(),
      viewBg: vP.bg,
      viewColor: vP.color,
      viewBorder: vP.border,
      editBg: eP.bg,
      editColor: eP.color,
      editBorder: eP.border,
      shareEmailInput,
      setEmailInput: (e) => this.setEmailInput(e),
      addEmail: (e) => this.addEmail(e),
      shareEmailChips: shareEmails.map((email) => ({
        email,
        onRemove: () => this.removeEmail(email),
      })),
      toastVisible: !!toastMsg,
      toastMsg,
      toastBottom: isMobile ? 80 : 26,
    };
  }

  render() {
    return <AppView V={this.renderVals()} />;
  }
}
