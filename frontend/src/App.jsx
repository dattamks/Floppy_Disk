import React from 'react';
import { theme } from './lib/theme';
import { api, firstError } from './api';
import { humanSize, fmtStorage, TIER_LABELS, kindOf } from './lib/ui';
import AppView from './view/AppView';

export default class App extends React.Component {
  state = {
    files: this.buildFiles(),
    channels: this.buildChannels(),
    posts: this.buildPosts(),
    authView: 'login',
    authName: '',
    authEmail: '',
    authPassword: '',
    authPhone: '',
    authDob: '',
    authCode: '',
    authError: '',
    authBusy: false,
    usedGB: 4.6,
    reportPostId: null,
    reportReason: '',
    commentsOpenFor: null,
    commentInput: '',
    newChName: '',
    newChHandle: '',
    newChCategory: 'Design',
    newFolderName: '',
    videoVolume: 1,
    videoRate: 1,
    videoLoading: false,
    deviceMode: 'desktop',
    vw: typeof window !== 'undefined' ? window.innerWidth : 1200,
    currentFolderId: null,
    filterKey: 'all',
    channelsTab: 'discover',
    discoverQuery: '',
    discoverCategory: 'all',
    trendingSort: 'likes',
    searchQuery: '',
    mobileSearchOpen: false,
    drawerOpen: false,
    modal: null,
    activeFileId: null,
    activeChannelId: null,
    openChannelId: null,
    discoverView: 'list',
    settingsTab: 'profile',
    verifyType: 'email',
    verifyCode: '',
    profileName: '',
    profileUsername: '',
    profileBio: '',
    accountEmail: '',
    accountPhone: '',
    emailVerified: false,
    phoneVerified: false,
    twofa: false,
    pwCurrent: '',
    pwNew: '',
    pwConfirm: '',
    composerText: '',
    composerAttach: null,
    csNameInput: '',
    csDesc: 'Team broadcast channel.',
    csWhoCanPost: 'admins',
    csNotif: true,
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
    videoUpgradeHint: false,
    videoFullscreen: false,
    unreadCount: 0,
    billingEnabled: false,
    discoverResults: [],
    realUsedBytes: null,
    realQuotaBytes: null,
    realTierLabel: null,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
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
        channel: false,
        starred: false,
        trashed: true,
        deletedDaysAgo: 1,
      },
    ];
  }

  buildChannels() {
    return [
      {
        id: 'ch-design',
        name: 'Design Team',
        handle: '@designteam',
        color: theme.brand,
        initials: 'DT',
        subs: '1.2K',
        subsNum: 1200,
        live: false,
        subscribed: true,
        isAdmin: true,
        category: 'Design',
        isNew: false,
      },
      {
        id: 'ch-eng',
        name: 'Engineering',
        handle: '@engineering',
        color: theme.teal,
        initials: 'EN',
        subs: '860',
        subsNum: 860,
        live: true,
        subscribed: true,
        isAdmin: false,
        category: 'Engineering',
        isNew: false,
      },
      {
        id: 'ch-mktg',
        name: 'Marketing Drops',
        handle: '@mktgdrops',
        color: theme.danger,
        initials: 'MK',
        subs: '3.4K',
        subsNum: 3400,
        live: false,
        subscribed: false,
        isAdmin: false,
        category: 'Marketing',
        isNew: true,
      },
      {
        id: 'ch-allhands',
        name: 'All Hands',
        handle: '@allhands',
        color: theme.warn,
        initials: 'AH',
        subs: '5.1K',
        subsNum: 5100,
        live: false,
        subscribed: false,
        isAdmin: false,
        category: 'Company',
        isNew: false,
      },
      {
        id: 'ch-product',
        name: 'Product Updates',
        handle: '@productupdates',
        color: theme.violet,
        initials: 'PR',
        subs: '410',
        subsNum: 410,
        live: false,
        subscribed: false,
        isAdmin: false,
        category: 'Product',
        isNew: true,
      },
    ];
  }

  buildPosts() {
    const P = (s) => `https://picsum.photos/seed/${s}/720/440`;
    const V = 'https://storage.googleapis.com/gtv-videos-bucket/sample/';
    return [
      {
        id: 'p1',
        channelId: 'ch-mktg',
        time: '2h',
        media: 'video',
        text: 'New Q3 brand film is live 🎬 Full cut below — share widely!',
        poster: P('post-brand'),
        videoSrc: V + 'BigBuckBunny.mp4',
        duration: '9:56',
        views: '4.2K',
        viewsNum: 4200,
        likes: 128,
        sharesNum: 340,
        liked: false,
      },
      {
        id: 'p2',
        channelId: 'ch-design',
        time: '5h',
        media: 'image',
        text: 'Fresh hero shots from yesterday\u2019s product shoot. Which crop do you prefer?',
        poster: P('post-hero'),
        views: '1.1K',
        viewsNum: 1100,
        likes: 64,
        sharesNum: 58,
        liked: false,
      },
      {
        id: 'p3',
        channelId: 'ch-eng',
        time: '1d',
        media: 'file',
        text: 'Design review recording + notes attached. Timestamps in the doc.',
        fileName: 'design-review-notes.pdf',
        fileSize: '512 KB',
        docUrl: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
        views: '640',
        viewsNum: 640,
        likes: 22,
        sharesNum: 20,
        liked: false,
      },
      {
        id: 'p4',
        channelId: 'ch-allhands',
        time: '1d',
        media: 'video',
        text: 'Monday all-hands replay for anyone who missed it.',
        poster: P('post-allhands'),
        videoSrc: V + 'ForBiggerBlazes.mp4',
        duration: '15:00',
        views: '5.0K',
        viewsNum: 5000,
        likes: 210,
        sharesNum: 410,
        liked: true,
      },
      {
        id: 'p5',
        channelId: 'ch-design',
        time: '2d',
        media: 'none',
        text: 'Reminder: design crit moved to 3pm today. Bring your Figma links 🎨',
        views: '820',
        viewsNum: 820,
        likes: 41,
        sharesNum: 12,
        liked: false,
      },
      {
        id: 'p6',
        channelId: 'ch-product',
        time: '3h',
        media: 'image',
        text: 'Introducing dark mode ✨ Rolling out to everyone this week.',
        poster: P('post-darkmode'),
        views: '2.3K',
        viewsNum: 2300,
        likes: 150,
        sharesNum: 95,
        liked: false,
      },
    ].map((p) => ({
      comments: [],
      own: false,
      ...p,
      comments:
        p.id === 'p1'
          ? [
              { id: 'c1', name: 'Priya', text: 'This looks incredible 🔥' },
              { id: 'c2', name: 'Marco', text: 'Sharing with my team now.' },
            ]
          : p.id === 'p4'
            ? [{ id: 'c3', name: 'Sam', text: 'Thanks for the replay!' }]
            : [],
    }));
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
      }
    };
    window.addEventListener('keydown', this._onKey);
    this.bootstrapSession();
    try {
      const raw = localStorage.getItem('floppydisk-state');
      if (raw) {
        const d = JSON.parse(raw);
        this.setState({
          files: d.files || this.state.files,
          channels: d.channels || this.state.channels,
          posts: d.posts || this.state.posts,
          usedGB: d.usedGB != null ? d.usedGB : this.state.usedGB,
          profileName: d.profileName || this.state.profileName,
          profileUsername: d.profileUsername || this.state.profileUsername,
          profileBio: d.profileBio || this.state.profileBio,
          emailVerified: d.emailVerified != null ? d.emailVerified : this.state.emailVerified,
          phoneVerified: d.phoneVerified != null ? d.phoneVerified : this.state.phoneVerified,
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
          files: s.files,
          channels: s.channels,
          posts: s.posts,
          usedGB: s.usedGB,
          profileName: s.profileName,
          profileUsername: s.profileUsername,
          profileBio: s.profileBio,
          emailVerified: s.emailVerified,
          phoneVerified: s.phoneVerified,
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
  setAuthPhone(e) {
    this.setState({ authPhone: e.target.value, authError: '' });
  }
  setAuthDob(e) {
    this.setState({ authDob: e.target.value, authError: '' });
  }
  setAuthCode(e) {
    this.setState({ authCode: e.target.value, authError: '' });
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
      billingEnabled: !!user.billing_enabled,
    });
    this.loadStorage();
    this.loadUsage();
    this.loadChannels();
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
          realTierLabel: TIER_LABELS[u.tier] || (u.tier ? String(u.tier) : null),
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
  authSkip() {
    const v = this.state.authView;
    if (v === 'verifyEmail') this.setState({ authView: 'verifyPhone', authCode: '' });
    else this.setState({ authView: 'app' });
  }
  toastForgot() {
    this.toast('Password reset link sent');
  }
  toastResend() {
    this.toast('A new code has been sent');
  }

  go(filterKey) {
    this.setState({
      filterKey,
      currentFolderId: null,
      searchQuery: '',
      drawerOpen: false,
      mobileSearchOpen: false,
      openChannelId: null,
    });
  }
  navToAll() {
    this.go('all');
  }
  navToFolder(id) {
    this.setState({ filterKey: 'all', currentFolderId: id, searchQuery: '' });
  }
  navToShared() {
    this.go('shared');
  }
  navToChannels() {
    this.go('channels');
  }
  navToRecent() {
    this.go('recent');
  }
  navToTrash() {
    this.go('trash');
  }
  setTabDiscover() {
    this.setState({ channelsTab: 'discover', openChannelId: null });
  }
  setTabSubscribed() {
    this.setState({ channelsTab: 'subscribed', openChannelId: null });
  }
  setDiscoverQuery(e) {
    this.setState({ discoverQuery: e.target.value });
  }
  openChannelView(id) {
    this.setState({ openChannelId: id });
  }
  closeChannelView() {
    this.setState({ openChannelId: null });
  }
  setDiscoverList() {
    this.setState({ discoverView: 'list' });
  }
  setDiscoverGrid() {
    this.setState({ discoverView: 'grid' });
  }
  clearDiscoverQuery() {
    this.setState({ discoverQuery: '' });
  }
  setDiscoverCategory(cat) {
    this.setState({ discoverCategory: cat });
  }
  setTrendingSort(sort) {
    this.setState({ trendingSort: sort });
  }
  toggleSubscribe(id) {
    const c = this.state.channels.find((x) => x.id === id);
    const willSubscribe = !(c && c.subscribed);
    if (c && c.real) {
      const call = willSubscribe ? api.subscribeChannel(id) : api.unsubscribeChannel(id);
      call.catch((err) => this.toast(firstError(err, 'Could not update subscription')));
    }
    this.setState((s) => ({
      channels: s.channels.map((x) =>
        x.id === id
          ? {
              ...x,
              subscribed: willSubscribe,
              subsNum: Math.max(0, (x.subsNum || 0) + (willSubscribe ? 1 : -1)),
            }
          : x
      ),
    }));
    this.toast(willSubscribe ? 'Subscribed' : 'Unsubscribed');
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
              channel: false,
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
    this.setState({ searchQuery: '', discoverResults: [] });
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
      csNameInput: '',
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
    this.toast('Profile saved');
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
    this.setState((s) => ({ twofa: !s.twofa }));
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
    const { pwNew, pwConfirm } = this.state;
    if (!pwNew) {
      this.toast('Enter a new password');
      return;
    }
    if (pwNew !== pwConfirm) {
      this.toast('Passwords do not match');
      return;
    }
    this.setState({ pwCurrent: '', pwNew: '', pwConfirm: '' });
    this.toast('Password updated');
  }
  verifyEmailModal() {
    this.setState({ modal: 'verify', verifyType: 'email', verifyCode: '' });
  }
  verifyPhoneModal() {
    this.setState({ modal: 'verify', verifyType: 'phone', verifyCode: '' });
  }
  setVerifyCode(e) {
    this.setState({ verifyCode: e.target.value });
  }
  confirmVerify() {
    const t = this.state.verifyType;
    if (t === 'email')
      this.setState({ emailVerified: true, modal: 'settings', settingsTab: 'account' });
    else this.setState({ phoneVerified: true, modal: 'settings', settingsTab: 'account' });
    this.toast((t === 'email' ? 'Email' : 'Phone') + ' verified');
  }
  backToSettings() {
    this.setState({ modal: 'settings', settingsTab: 'account' });
  }

  openComposer() {
    const ch =
      this.state.channels.find((c) => c.subscribed && c.isAdmin) ||
      this.state.channels.find((c) => c.isAdmin);
    this.setState({
      modal: 'composer',
      activeChannelId: ch ? ch.id : null,
      composerText: '',
      composerAttach: null,
    });
  }
  setComposerText(e) {
    this.setState({ composerText: e.target.value });
  }
  attachPhoto() {
    this.setState({
      composerAttach: {
        type: 'image',
        poster: `https://picsum.photos/seed/new${Date.now()}/720/440`,
      },
    });
  }
  attachVideo() {
    this.setState({
      composerAttach: {
        type: 'video',
        poster: `https://picsum.photos/seed/newv${Date.now()}/720/440`,
        videoSrc: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        duration: '0:15',
      },
    });
  }
  attachFile() {
    this.setState({
      composerAttach: {
        type: 'file',
        fileName: 'attachment.pdf',
        fileSize: '320 KB',
        docUrl: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
      },
    });
  }
  clearAttach() {
    this.setState({ composerAttach: null });
  }
  submitPost() {
    const { composerText, composerAttach, activeChannelId } = this.state;
    if (!composerText.trim() && !composerAttach) {
      this.toast('Write something first');
      return;
    }
    const a = composerAttach;
    const post = {
      id: 'post-' + Date.now(),
      channelId: activeChannelId,
      time: 'now',
      media: a ? a.type : 'none',
      text: composerText.trim(),
      poster: a && a.poster,
      videoSrc: a && a.videoSrc,
      duration: a && a.duration,
      fileName: a && a.fileName,
      fileSize: a && a.fileSize,
      docUrl: a && a.docUrl,
      views: '0',
      viewsNum: 0,
      likes: 0,
      sharesNum: 0,
      liked: false,
      own: true,
      comments: [],
    };
    this.setState((s) => ({
      posts: [post, ...s.posts],
      modal: null,
      composerText: '',
      composerAttach: null,
    }));
    this.toast('Posted to channel');
  }
  deletePost(id) {
    this.setState((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
    this.toast('Post deleted');
  }

  toggleComments(id) {
    this.setState((s) => ({
      commentsOpenFor: s.commentsOpenFor === id ? null : id,
      commentInput: '',
    }));
  }
  setCommentInput(e) {
    this.setState({ commentInput: e.target.value });
  }
  addComment(id) {
    const t = this.state.commentInput.trim();
    if (!t) return;
    this.setState((s) => ({
      posts: s.posts.map((p) =>
        p.id === id
          ? {
              ...p,
              comments: [
                ...(p.comments || []),
                { id: 'c' + Date.now(), name: s.profileName.split(' ')[0] || 'You', text: t },
              ],
            }
          : p
      ),
      commentInput: '',
    }));
  }

  openNewChannel() {
    this.setState({ modal: 'newChannel', newChName: '', newChHandle: '', newChCategory: 'Design' });
  }
  setNewChName(e) {
    this.setState({ newChName: e.target.value });
  }
  setNewChHandle(e) {
    this.setState({ newChHandle: e.target.value });
  }
  setNewChCategory(cat) {
    this.setState({ newChCategory: cat });
  }
  _mapChannel(c) {
    const palette = [theme.brand, theme.teal, theme.danger, theme.warn, theme.violet];
    const initials = (c.name || '?')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    let hash = 0;
    for (const ch of c.handle || '') hash = (hash + ch.charCodeAt(0)) % palette.length;
    return {
      id: c.id,
      name: c.name,
      handle: c.handle.startsWith('@') ? c.handle : '@' + c.handle,
      color: palette[hash],
      initials,
      subs: String(c.subscriber_count ?? 1),
      subsNum: c.subscriber_count ?? 1,
      live: false,
      subscribed: !!c.role,
      isAdmin: c.role === 'owner' || c.role === 'admin',
      category: 'General',
      isNew: false,
      real: true,
    };
  }

  createChannel() {
    const s = this.state;
    const name = s.newChName.trim();
    if (!name) {
      this.toast('Enter a channel name');
      return;
    }
    const handle = (s.newChHandle.trim() || name.toLowerCase().replace(/\s+/g, '')).replace(
      /^@/,
      ''
    );
    api
      .createChannel({ name, handle, is_public: true })
      .then((c) => {
        this.setState((st) => ({
          channels: [this._mapChannel(c), ...st.channels],
          modal: null,
          newChName: '',
          newChHandle: '',
        }));
        this.toast('Channel created');
      })
      .catch((err) => this.toast(firstError(err, 'Could not create channel')));
  }

  // Load discoverable + subscribed channels from the backend, merged by id.
  loadChannels() {
    Promise.all([
      api.listChannels(false).catch(() => []),
      api.listChannels(true).catch(() => []),
    ]).then(([pub, mine]) => {
      const byId = new Map();
      [...(pub || []), ...(mine || [])].forEach((c) => byId.set(c.id, this._mapChannel(c)));
      if (!byId.size) return;
      this.setState((st) => {
        const existing = new Set(st.channels.map((c) => c.id));
        const fresh = [...byId.values()].filter((c) => !existing.has(c.id));
        return fresh.length ? { channels: [...fresh, ...st.channels] } : null;
      });
    });
  }

  openReport(id) {
    this.setState({ modal: 'report', reportPostId: id, reportReason: '' });
  }
  setReportReason(r) {
    this.setState({ reportReason: r });
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
              modified: '',
              shared: false,
              channel: false,
              starred: false,
              trashed: false,
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
  submitReport() {
    if (!this.state.reportReason) {
      this.toast('Select a reason');
      return;
    }
    const id = this.state.reportPostId;
    const isUuid = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);
    if (isUuid) {
      api
        .report({
          kind: 'report',
          target_type: 'post',
          target_id: id,
          reason: 'inappropriate',
          detail: this.state.reportReason,
        })
        .catch(() => {});
    }
    this.setState({ modal: null, reportPostId: null });
    this.toast('Reported to moderators');
  }
  flagPost() {
    this.toast('Post flagged for review');
  }

  openChannelSettings(id) {
    const ch = this.state.channels.find((c) => c.id === id);
    this.setState({
      modal: 'channelSettings',
      activeChannelId: id,
      csNameInput: ch ? ch.name : '',
      csWhoCanPost: 'admins',
      csNotif: true,
    });
  }
  setCsName(e) {
    this.setState({ csNameInput: e.target.value });
  }
  setCsDesc(e) {
    this.setState({ csDesc: e.target.value });
  }
  setPostAdmins() {
    this.setState({ csWhoCanPost: 'admins' });
  }
  setPostEveryone() {
    this.setState({ csWhoCanPost: 'everyone' });
  }
  toggleChNotif() {
    this.setState((s) => ({ csNotif: !s.csNotif }));
  }
  saveChannel() {
    const id = this.state.activeChannelId,
      name = this.state.csNameInput;
    this.setState((s) => ({ channels: s.channels.map((c) => (c.id === id ? { ...c, name } : c)) }));
    this.toast('Channel updated');
  }
  leaveChannel() {
    const id = this.state.activeChannelId;
    this.setState((s) => ({
      channels: s.channels.map((c) => (c.id === id ? { ...c, subscribed: false } : c)),
      modal: null,
    }));
    this.toast('You left the channel');
  }

  likePost(id) {
    this.setState((s) => ({
      posts: s.posts.map((p) =>
        p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p
      ),
    }));
  }
  reportPost() {
    this.toast('Reported to moderators');
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
    this._activeMediaObj = null;
    this.setState({
      modal: null,
      activeFileId: null,
      videoPlaying: false,
      videoProgress: 0,
      videoCurrent: 0,
      videoDuration: 0,
      videoUpgradeHint: false,
      videoFullscreen: false,
      shareCopied: false,
    });
  }
  openFile(file) {
    if (file.kind === 'folder') {
      this.setState({ currentFolderId: file.id, filterKey: 'all', searchQuery: '' });
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
        // Fetch a real playback URL (private -> R2 signed; promoted -> HLS).
        api
          .play(file.id)
          .then((d) => {
            this._activeVideoSrc = d.url;
            this.forceUpdate();
          })
          .catch(() => {});
      }
      return;
    }
    this._activeAudioSrc = file.audioSrc || '';
    this.setState({ modal: 'preview', activeFileId: file.id });
  }
  openPostMedia(post, channel) {
    const chName = channel ? channel.name : 'Channel';
    if (post.media === 'video') {
      this._videoEl = null;
      this._activeVideoSrc = post.videoSrc;
      this._activePoster = post.poster;
      this._activeMediaObj = {
        id: post.id,
        name: post.fileName || chName + ' — video',
        kind: 'video',
        channelLine: chName + ' · Channel post',
        poster: post.poster,
        videoSrc: post.videoSrc,
        duration: post.duration,
        size: '',
        modified: '',
      };
      this.setState({
        modal: 'video',
        activeFileId: '__media',
        videoPlaying: false,
        videoProgress: 0,
        videoCurrent: 0,
        videoDuration: 0,
        videoFullscreen: false,
      });
    } else if (post.media === 'image') {
      this._activeAudioSrc = '';
      this._activePoster = post.poster;
      this._activeMediaObj = {
        id: post.id,
        name: chName + ' — photo',
        kind: 'image',
        poster: post.poster,
        size: '',
        modified: '',
      };
      this.setState({ modal: 'preview', activeFileId: '__media' });
    } else if (post.media === 'file') {
      this._activeAudioSrc = '';
      this._activeMediaObj = {
        id: post.id,
        name: post.fileName,
        kind: 'doc',
        docUrl: post.docUrl,
        size: post.fileSize,
        modified: '',
      };
      this.setState({ modal: 'preview', activeFileId: '__media' });
    }
  }
  sharePost(post, channel) {
    const chName = channel ? channel.name : 'Channel';
    this._activeMediaObj = {
      id: post.id,
      name: post.fileName || chName + ' post',
      kind: post.media,
    };
    this.setState({
      modal: 'share',
      activeFileId: '__media',
      shareAccess: 'anyone',
      sharePermission: 'view',
      shareEmails: [],
      shareEmailInput: '',
      shareCopied: false,
    });
  }
  openShare(file, e) {
    if (e) e.stopPropagation();
    this._activeMediaObj = null;
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
    if (this._activeMediaObj && this.state.activeFileId === '__media') {
      const m = this._activeMediaObj;
      this.setState({
        modal: 'share',
        shareAccess: 'restricted',
        sharePermission: 'view',
        shareEmails: [],
        shareEmailInput: '',
        shareCopied: false,
      });
      return;
    }
    const f = this.state.files.find((x) => x.id === this.state.activeFileId);
    if (f) this.openShare(f);
  }
  downloadActive() {
    const f =
      this._activeMediaObj || this.state.files.find((x) => x.id === this.state.activeFileId);
    const url = f && (f.docUrl || f.audioSrc || f.poster || f.videoSrc);
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
    if (f && f.real) api.restoreFile(id).catch(() => {});
    this.setState((s) => ({
      files: s.files.map((x) => (x.id === id ? { ...x, trashed: false } : x)),
    }));
    this.toast('Restored');
  }
  deleteForever(id, e) {
    if (e) e.stopPropagation();
    const f = this.state.files.find((x) => x.id === id);
    if (!f) return;
    if (f.trashed) {
      // Permanent purge from trash.
      if (f.real) api.purgeFile(id).catch(() => {});
      this.setState((s) => ({ files: s.files.filter((x) => x.id !== id), modal: null }));
      this.toast('Deleted permanently');
    } else {
      // Soft delete: move to trash (still counts toward quota until purged).
      if (f.real)
        api.deleteFile(id).catch((err) => this.toast(firstError(err, 'Could not delete')));
      this.setState((s) => ({
        files: s.files.map((x) => (x.id === id ? { ...x, trashed: true } : x)),
        modal: null,
      }));
      this.toast('Moved to trash');
    }
  }
  emptyTrash() {
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
          modified: 'Just now',
          shared: false,
          channel: false,
          starred: false,
          trashed: false,
          real: true,
        };
        this.setState((s) => ({
          files: [nf, ...s.files.filter((x) => x.id !== qid)],
          uploadQueue: s.uploadQueue.filter((u) => u.id !== qid),
        }));
        this.toast('Uploaded');
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
              channel: false,
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
  selectHD() {
    this.setState({ videoUpgradeHint: true });
    setTimeout(() => this.setState({ videoUpgradeHint: false }), 2500);
  }

  upgradeStorage() {
    if (this._upgrading) return;
    this._upgrading = true;
    api
      .subscribe('paid_2tb')
      .then((res) => {
        this._upgrading = false;
        this.setState({ userTier: res.tier, quotaBytes: res.quota_bytes });
        this.toast('Upgraded to 2TB — enjoy the extra space');
      })
      .catch((err) => {
        this._upgrading = false;
        this.toast(firstError(err, 'Upgrade failed'));
      });
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

  renderVals() {
    const st = this.state;
    const {
      files,
      channels,
      posts,
      authView,
      deviceMode,
      currentFolderId,
      filterKey,
      channelsTab,
      discoverQuery,
      discoverCategory,
      discoverView,
      openChannelId,
      searchQuery,
      mobileSearchOpen,
      drawerOpen,
      modal,
      activeFileId,
      settingsTab,
      verifyType,
      verifyCode,
      emailVerified,
      phoneVerified,
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
      videoUpgradeHint,
      videoFullscreen,
      csWhoCanPost,
      csNotif,
      composerAttach,
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
      const daysLeft = f.trashed ? Math.max(0, 7 - (f.deletedDaysAgo || 0)) : null;
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
        tileBg: isDoc ? theme.dangerBgSoft : theme.tealBg,
        starFill: f.starred ? theme.star : 'none',
        starStroke: f.starred ? theme.star : theme.textFaint,
        metaLine: isFolder
          ? itemCount + (itemCount === 1 ? ' item' : ' items')
          : `${f.size || ''}${f.size && f.modified ? ' · ' : ''}${f.modified || ''}`,
        retentionLabel:
          daysLeft !== null ? daysLeft + (daysLeft === 1 ? ' day left' : ' days left') : '',
        channelLine: f.channelLine || (f.channel ? 'Team Channel · Broadcast' : 'Uploaded by you'),
        shareUrl: 'floppy.disk/s/' + f.id,
        imgRef: mkImgRef(f.poster),
        onOpen: () => this.openFile(f),
        onShare: (e) => this.openShare(f, e),
        onToggleStar: (e) => this.toggleStar(f.id, e),
        onRestore: (e) => this.restoreFile(f.id, e),
        onDeleteForever: (e) => this.deleteForever(f.id, e),
        onCtxMenu: (e) => this.openCtxMenu(f, e),
        onDownload: () => this.downloadFile(f),
      };
    };

    let rawList,
      sectionTitle,
      currentFolderName = null,
      showBreadcrumb = false,
      isChannelsView = false;
    if (searchActive) {
      const local = nonTrashed.filter((f) => f.name.toLowerCase().includes(q));
      const localIds = new Set(local.map((f) => f.id));
      const extra = (discoverResults || []).filter((r) => !localIds.has(r.id));
      rawList = [...local, ...extra];
      sectionTitle = 'Results for "' + searchQuery.trim() + '"';
    } else if (filterKey === 'all') {
      rawList = nonTrashed.filter((f) => f.parentId === currentFolderId);
      const cf = currentFolderId ? files.find((f) => f.id === currentFolderId) : null;
      currentFolderName = cf ? cf.name : null;
      sectionTitle = currentFolderName || 'My Files';
      showBreadcrumb = true;
      rawList.sort(
        (a, b) =>
          (a.kind === 'folder' ? 0 : 1) - (b.kind === 'folder' ? 0 : 1) ||
          a.name.localeCompare(b.name)
      );
    } else if (filterKey === 'shared') {
      rawList = nonTrashed.filter((f) => f.shared);
      sectionTitle = 'Shared with me';
    } else if (filterKey === 'channels') {
      rawList = [];
      sectionTitle = 'Channels';
      isChannelsView = true;
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
    const searchHasChannelMatch =
      searchActive &&
      channels.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    const isEmpty = !isChannelsView && visibleFiles.length === 0 && !searchHasChannelMatch;
    const emptyMessage = searchActive
      ? 'No files or channels match your search'
      : filterKey === 'all' && currentFolderId
        ? 'This folder is empty'
        : filterKey === 'trash'
          ? 'Trash is empty'
          : filterKey === 'shared'
            ? 'Nothing shared yet'
            : 'No files yet';
    const isHome = !searchActive && filterKey === 'all' && !currentFolderId;
    const showCarousel = isHome && !isEmpty;

    const chById = {};
    channels.forEach((c) => {
      chById[c.id] = c;
    });
    const tabSubscribed = channelsTab === 'subscribed';
    const buildCard = (c) => ({
      color: c.color,
      initials: c.initials,
      name: c.name,
      handle: c.handle,
      category: c.category,
      subs: c.subs,
      live: c.live,
      isAdmin: c.isAdmin,
      isNew: c.isNew,
      subscribed: c.subscribed,
      subLabel: c.subscribed ? 'Following' : 'Subscribe',
      subBg: c.subscribed ? theme.brandBg : theme.brand,
      subColor: c.subscribed ? theme.brand : theme.white,
      subBorder: c.subscribed ? theme.brandBorder : theme.brand,
      onToggle: () => this.toggleSubscribe(c.id),
      onSettings: () => this.openChannelSettings(c.id),
      onView: () => this.openChannelView(c.id),
    });
    const makePostView = (p) => {
      const ch = chById[p.channelId] || {};
      return {
        id: p.id,
        color: ch.color,
        initials: ch.initials,
        channelName: ch.name,
        handle: ch.handle,
        time: p.time,
        hasText: !!p.text,
        text: p.text,
        isImage: p.media === 'image',
        isVideo: p.media === 'video',
        isFile: p.media === 'file',
        poster: p.poster,
        duration: p.duration,
        fileName: p.fileName,
        fileSize: p.fileSize,
        views: p.views,
        likes: p.likes,
        likeColor: p.liked ? theme.danger : theme.textMuted,
        likeFill: p.liked ? theme.danger : 'none',
        likeBg: p.liked ? theme.dangerBg2 : 'transparent',
        isOwn: !!p.own,
        comments: (p.comments || []).map((c) => ({
          id: c.id,
          name: c.name,
          text: c.text,
          initial: (c.name || '?')[0].toUpperCase(),
        })),
        commentCount: (p.comments || []).length,
        commentsOpen: st.commentsOpenFor === p.id,
        imgRef: mkImgRef(p.poster),
        onOpen: () => this.openPostMedia(p, ch),
        onLike: () => this.likePost(p.id),
        onShare: () => this.sharePost(p, ch),
        onFlag: () => this.flagPost(),
        onReport: () => this.openReport(p.id),
        onToggleComments: () => this.toggleComments(p.id),
        onAddComment: () => this.addComment(p.id),
        onDelete: () => this.deletePost(p.id),
      };
    };
    const feedPosts = tabSubscribed
      ? posts.filter((p) => (chById[p.channelId] || {}).subscribed)
      : posts;
    const postViews = feedPosts.map(makePostView);
    const adminChannel = channels.find((c) => c.subscribed && c.isAdmin);

    const openCh = openChannelId ? chById[openChannelId] : null;
    const channelPostViews = openCh
      ? posts.filter((p) => p.channelId === openCh.id).map(makePostView)
      : [];

    const dq = discoverQuery.trim().toLowerCase();
    const categories = ['all', ...Array.from(new Set(channels.map((c) => c.category)))];
    const categoryChips = categories.map((cat) => ({
      key: cat,
      label: cat === 'all' ? 'All' : cat,
      active: discoverCategory === cat,
      onClick: () => this.setDiscoverCategory(cat),
    }));
    const matchesDiscover = (c) =>
      (discoverCategory === 'all' || c.category === discoverCategory) &&
      (!dq ||
        c.name.toLowerCase().includes(dq) ||
        c.handle.toLowerCase().includes(dq) ||
        c.category.toLowerCase().includes(dq));
    const discoverFilteredChannels = channels.filter(matchesDiscover);
    const discoverCards = discoverFilteredChannels.map(buildCard);
    const newChannelCards = discoverFilteredChannels.filter((c) => c.isNew).map(buildCard);
    const topRatedCards = [...discoverFilteredChannels]
      .sort((a, b) => b.subsNum - a.subsNum)
      .slice(0, 4)
      .map(buildCard);
    const isDiscoverTab = !tabSubscribed;
    const channelRows = (
      tabSubscribed ? channels.filter((c) => c.subscribed) : discoverFilteredChannels
    ).map(buildCard);
    const channelListRows = [...discoverFilteredChannels]
      .sort(
        (a, b) =>
          (a.subscribed === b.subscribed ? 0 : a.subscribed ? -1 : 1) || b.subsNum - a.subsNum
      )
      .map(buildCard);
    const subscribedChips = channels.filter((c) => c.subscribed).map(buildCard);

    const trendingSort = st.trendingSort;
    const metricKey =
      trendingSort === 'views' ? 'viewsNum' : trendingSort === 'shares' ? 'sharesNum' : 'likes';
    const trendingCards = [...posts]
      .sort((a, b) => b[metricKey] - a[metricKey])
      .slice(0, 6)
      .map((p) => {
        const ch = chById[p.channelId] || {};
        const metricVal =
          trendingSort === 'views'
            ? p.views
            : trendingSort === 'shares'
              ? p.sharesNum >= 1000
                ? (p.sharesNum / 1000).toFixed(1) + 'K'
                : String(p.sharesNum)
              : String(p.likes);
        const metricLabel =
          trendingSort === 'views'
            ? metricVal + ' views'
            : trendingSort === 'shares'
              ? metricVal + ' shares'
              : metricVal + ' likes';
        return {
          title: p.fileName || ch.name + ' post',
          channelName: ch.name,
          poster: p.poster || `https://picsum.photos/seed/${p.id}/400/280`,
          metricLabel,
          imgRef: mkImgRef(p.poster),
          onOpen: () => this.openPostMedia(p, ch),
        };
      });

    const searchChannelResults = searchActive
      ? channels
          .filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.handle.toLowerCase().includes(q) ||
              c.category.toLowerCase().includes(q)
          )
          .map(buildCard)
      : [];
    const showSearchChannels = searchActive && searchChannelResults.length > 0;
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

    const activeRaw =
      activeFileId === '__media'
        ? this._activeMediaObj
        : activeFileId
          ? files.find((f) => f.id === activeFileId)
          : null;
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
    const paSeg = seg(csWhoCanPost === 'admins'),
      peSeg = seg(csWhoCanPost === 'everyone');

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
      verifyEmail: 'Verify your email',
      verifyPhone: 'Verify your phone',
      forgot: 'Reset password',
    };
    const authSubs = {
      login: 'Sign in to your Floppy Disk account',
      register: 'Start with 5 GB free storage',
      verifyEmail: 'We sent a 6-digit code to ' + (st.authEmail || 'your email'),
      verifyPhone: 'Add your phone for account recovery',
      forgot: 'Enter your email and we\u2019ll send a reset link',
    };
    const csCh = channels.find((c) => c.id === st.activeChannelId) || {};
    const compCh = channels.find((c) => c.id === st.activeChannelId) || {};

    return {
      d,
      isMobile,
      isDesktop: !isMobile,
      isApp,
      isAuth: !isApp,
      urlPath: !isApp
        ? authView === 'register'
          ? 'signup'
          : 'login'
        : isChannelsView
          ? 'channels'
          : 'files',
      authTitle: authTitles[authView] || 'Floppy Disk',
      authSubtitle: authSubs[authView] || '',
      authIsLogin: authView === 'login',
      // Demo credentials hint only in dev builds, never in production.
      showDemoCreds: !!(import.meta && import.meta.env && import.meta.env.DEV),
      authIsRegister: authView === 'register',
      authIsForgot: authView === 'forgot',
      authIsVerifyEmail: authView === 'verifyEmail',
      authIsVerifyPhone: authView === 'verifyPhone',
      authIsVerify: authView === 'verifyEmail' || authView === 'verifyPhone',
      authNeedsEmail: authView === 'login' || authView === 'register' || authView === 'forgot',
      authNeedsPassword: authView === 'login' || authView === 'register',
      authName: st.authName,
      authEmail: st.authEmail,
      authPassword: st.authPassword,
      authPhone: st.authPhone,
      authDob: st.authDob,
      authCode: st.authCode,
      authBusy: st.authBusy,
      setAuthName: (e) => this.setAuthName(e),
      setAuthEmail: (e) => this.setAuthEmail(e),
      setAuthPassword: (e) => this.setAuthPassword(e),
      setAuthPhone: (e) => this.setAuthPhone(e),
      setAuthDob: (e) => this.setAuthDob(e),
      setAuthCode: (e) => this.setAuthCode(e),
      authPrimary: () => this.authPrimary(),
      authPrimaryLabel:
        {
          login: 'Sign in',
          register: 'Create account',
          verifyEmail: 'Verify email',
          verifyPhone: 'Verify phone',
          forgot: 'Send reset link',
        }[authView] || 'Continue',
      authSkip: () => this.authSkip(),
      authSkipLabel: authView === 'verifyEmail' ? 'Skip' : 'Skip for now',
      gotoRegister: () => this.gotoRegister(),
      gotoLogin: () => this.gotoLogin(),
      logout: () => this.logout(),
      toastForgot: () => this.toastForgot(),
      toastResend: () => this.toastResend(),
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
      upgradeStorage: () => this.upgradeStorage(),
      billingEnabled: st.billingEnabled,
      visibleFiles,
      hasFiles: !isEmpty && !isChannelsView,
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
      isChannelsView,
      notChannelsView: !isChannelsView,
      channelRows,
      posts: postViews,
      postsEmpty: postViews.length === 0,
      channelsTab,
      setTabDiscover: () => this.setTabDiscover(),
      setTabSubscribed: () => this.setTabSubscribed(),
      discoverTabBg: !tabSubscribed ? '#FFFFFF' : 'transparent',
      discoverTabColor: !tabSubscribed ? '#5145E5' : '#656B76',
      discoverTabShadow: !tabSubscribed ? '0 1px 3px rgba(16,24,40,0.12)' : 'none',
      subscribedTabBg: tabSubscribed ? '#FFFFFF' : 'transparent',
      subscribedTabColor: tabSubscribed ? '#5145E5' : '#656B76',
      subscribedTabShadow: tabSubscribed ? '0 1px 3px rgba(16,24,40,0.12)' : 'none',
      showComposerBtn: tabSubscribed && !!adminChannel,
      adminChannelName: adminChannel ? adminChannel.name : '',
      openComposer: () => this.openComposer(),
      isDiscoverTab,
      isSubscribedTab: tabSubscribed,
      channelListRows,
      subscribedChips,
      discoverEmpty: channelListRows.length === 0,
      hasSubscribed: subscribedChips.length > 0,
      discoverView,
      isDiscoverList: discoverView === 'list',
      isDiscoverGrid: discoverView === 'grid',
      setDiscoverList: () => this.setDiscoverList(),
      setDiscoverGrid: () => this.setDiscoverGrid(),
      listViewBg: discoverView === 'list' ? '#5145E5' : '#FFFFFF',
      listViewColor: discoverView === 'list' ? '#fff' : '#8A909B',
      listViewBorder: discoverView === 'list' ? '#5145E5' : '#E5E7EC',
      gridViewBg: discoverView === 'grid' ? '#5145E5' : '#FFFFFF',
      gridViewColor: discoverView === 'grid' ? '#fff' : '#8A909B',
      gridViewBorder: discoverView === 'grid' ? '#5145E5' : '#E5E7EC',
      showChannelDetail: !!openCh,
      showChannelBrowse: !openCh,
      closeChannelView: () => this.closeChannelView(),
      cdColor: openCh ? openCh.color : '#5145E5',
      cdInitials: openCh ? openCh.initials : '',
      cdName: openCh ? openCh.name : '',
      cdHandle: openCh ? openCh.handle : '',
      cdSubs: openCh ? openCh.subs : '',
      cdCategory: openCh ? openCh.category : '',
      cdLive: openCh ? openCh.live : false,
      cdIsAdmin: openCh ? openCh.isAdmin : false,
      cdSubLabel: openCh && openCh.subscribed ? 'Following' : 'Subscribe',
      cdSubBg: openCh && openCh.subscribed ? '#ECEBFD' : '#5145E5',
      cdSubColor: openCh && openCh.subscribed ? '#5145E5' : '#fff',
      cdSubBorder: openCh && openCh.subscribed ? '#C7C3F5' : '#5145E5',
      cdOnToggle: () => openCh && this.toggleSubscribe(openCh.id),
      cdOnSettings: () => openCh && this.openChannelSettings(openCh.id),
      cdOnCompose: () => openCh && this.openComposer(),
      channelPosts: channelPostViews,
      channelPostsEmpty: channelPostViews.length === 0,
      discoverQuery,
      setDiscoverQuery: (e) => this.setDiscoverQuery(e),
      clearDiscoverQuery: () => this.clearDiscoverQuery(),
      discoverQueryActive: dq.length > 0,
      categoryChips,
      discoverCards,
      hasNewChannels: newChannelCards.length > 0,
      newChannelCards,
      topRatedCards,
      trendingSort,
      likesSortActive: trendingSort === 'likes',
      viewsSortActive: trendingSort === 'views',
      sharesSortActive: trendingSort === 'shares',
      setSortLikes: () => this.setTrendingSort('likes'),
      setSortViews: () => this.setTrendingSort('views'),
      setSortShares: () => this.setTrendingSort('shares'),
      trendingCards,
      showSearchChannels,
      searchChannelResults,
      showCarousel,
      carouselItems,
      showGridLabel: showCarousel,
      gridLabel: 'Files & folders',
      sharedCount: nonTrashed.filter((f) => f.shared).length,
      channelsCount: channels.length,
      trashCount: files.filter((f) => f.trashed).length,
      navToAll: () => this.navToAll(),
      navToShared: () => this.navToShared(),
      navToChannels: () => this.navToChannels(),
      navToRecent: () => this.navToRecent(),
      navToTrash: () => this.navToTrash(),
      navAllBg: navBg(af('all')),
      navAllColor: navColor(af('all')),
      navAllWeight: navW(af('all')),
      navSharedBg: navBg(af('shared')),
      navSharedColor: navColor(af('shared')),
      navSharedWeight: navW(af('shared')),
      navChannelsBg: navBg(af('channels')),
      navChannelsColor: navColor(af('channels')),
      navChannelsWeight: navW(af('channels')),
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
      tierLabel: st.realTierLabel || 'Free',
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
      commentInput: st.commentInput,
      setCommentInput: (e) => this.setCommentInput(e),
      videoVolume: st.videoVolume,
      setVolume: (e) => this.setVolume(e),
      videoRate: st.videoRate,
      rateLabel: st.videoRate + '×',
      cycleRate: () => this.cycleRate(),
      videoLoading: st.videoLoading,
      openNewChannel: () => this.openNewChannel(),
      newChName: st.newChName,
      setNewChName: (e) => this.setNewChName(e),
      newChHandle: st.newChHandle,
      setNewChHandle: (e) => this.setNewChHandle(e),
      createChannel: () => this.createChannel(),
      newChCatChips: ['Design', 'Engineering', 'Marketing', 'Company', 'Product'].map((cat) => ({
        label: cat,
        active: st.newChCategory === cat,
        onClick: () => this.setNewChCategory(cat),
      })),
      isNewChannelModal: modal === 'newChannel',
      isReportModal: modal === 'report',
      submitReport: () => this.submitReport(),
      reportReasonChips: ['Spam or scam', 'Harassment', 'Violence', 'Misinformation', 'Other'].map(
        (r) => ({ label: r, active: st.reportReason === r, onClick: () => this.setReportReason(r) })
      ),
      modalOpen: !!modal,
      isUploadModal: modal === 'upload',
      isSettingsModal: modal === 'settings',
      isVerifyModal: modal === 'verify',
      isComposerModal: modal === 'composer',
      isChannelSettingsModal: modal === 'channelSettings',
      isPreviewModal: modal === 'preview',
      isVideoModal: modal === 'video',
      isShareModal: modal === 'share',
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
      accountPhone: st.accountPhone,
      emailVerified,
      emailNotVerified: !emailVerified,
      phoneVerified,
      phoneNotVerified: !phoneVerified,
      verifyEmailModal: () => this.verifyEmailModal(),
      verifyPhoneModal: () => this.verifyPhoneModal(),
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
      verifyType,
      verifyTarget: verifyType === 'email' ? st.accountEmail : st.accountPhone,
      verifyCode,
      setVerifyCode: (e) => this.setVerifyCode(e),
      confirmVerify: () => this.confirmVerify(),
      backToSettings: () => this.backToSettings(),
      composerChannelName: compCh.name || 'Channel',
      composerColor: compCh.color || '#5145E5',
      composerInitials: compCh.initials || 'CH',
      composerText: st.composerText,
      setComposerText: (e) => this.setComposerText(e),
      attachPhoto: () => this.attachPhoto(),
      attachVideo: () => this.attachVideo(),
      attachFile: () => this.attachFile(),
      clearAttach: () => this.clearAttach(),
      submitPost: () => this.submitPost(),
      composerHasAttach: !!composerAttach,
      composerAttachLabel: composerAttach
        ? composerAttach.type === 'image'
          ? 'Photo'
          : composerAttach.type === 'video'
            ? 'Video'
            : 'File'
        : '',
      csColor: csCh.color || '#5145E5',
      csInitials: csCh.initials || 'CH',
      csName: csCh.name || 'Channel',
      csSubs: csCh.subs || '0',
      csNameInput: st.csNameInput,
      setCsName: (e) => this.setCsName(e),
      csDesc: st.csDesc,
      setCsDesc: (e) => this.setCsDesc(e),
      setPostAdmins: () => this.setPostAdmins(),
      setPostEveryone: () => this.setPostEveryone(),
      postAdminsBg: paSeg.bg,
      postAdminsColor: paSeg.color,
      postAdminsBorder: paSeg.border,
      postEveryoneBg: peSeg.bg,
      postEveryoneColor: peSeg.color,
      postEveryoneBorder: peSeg.border,
      chNotifBg: csNotif ? '#5145E5' : '#CBD0D8',
      chNotifX: csNotif ? 20 : 2,
      toggleChNotif: () => this.toggleChNotif(),
      saveChannel: () => this.saveChannel(),
      leaveChannel: () => this.leaveChannel(),
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
      selectHD: () => this.selectHD(),
      toggleTheater: () => this.toggleTheater(),
      videoFullscreen,
      videoNotFullscreen: !videoFullscreen,
      videoUpgradeHint,
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
