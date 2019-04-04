/**
 * Authorized actions handling.
 *
 * @module cutechan/auth
 */
import { setter as s } from "../util";

import * as cx from "classnames";
import * as convert from 'color-convert';
import { Component, h, render } from "preact";
import { showAlert, showSendAlert } from "../alerts";
import API from "../api";
import { TabbedModal } from "../base";
import _ from "../lang";
import { Post } from "../posts";
import { getModel, page } from "../state";
import { Constructable, hook, HOOKS, on, remove, trigger, unhook } from "../util";
import {
  MODAL_CONTAINER_SEL, TRIGGER_BAN_BY_POST_SEL,
  TRIGGER_DELETE_POST_SEL, TRIGGER_IGNORE_USER_SEL, COLOR_PICKER_CURSOR, COLOR_PICKER_SEL, CONTRAST_RATIO,
} from "../vars";
import { BackgroundClickMixin, EscapePressMixin, MemberList } from "../widgets";
import { BoardCreationForm } from "./board-form";
import { LoginForm, validatePasswordMatch } from "./login-form";
import { PasswordChangeForm } from "./password-form";
import { ServerConfigForm } from "./server-form";

export const enum ModerationLevel {
  notLoggedIn = - 1,
  notStaff,
  blacklisted,
  whitelisted,
  janitor,
  moderator,
  boardOwner,
  admin,
}

export const enum IgnoreMode {
  disabled = -1,
  byBlacklist,
  byWhitelist,
}

export interface Session {
  userID: string;
  positions: Positions;
  settings: AccountSettings;
}

export interface Positions {
  curBoard: ModerationLevel;
  anyBoard: ModerationLevel;
}

export interface AccountSettings {
  name?: string;
  color?: string;
  showName?: boolean;
  ignoreMode?: IgnoreMode;
  includeAnon?: boolean;
  whitelist?: string[];
  blacklist?: string[];
}

declare global {
  interface Window {
    session?: Session;
  }
}

export const session = window.session;
export const account = session ? session.settings : {};
account.ignoreMode = account.ignoreMode || 0;
account.whitelist = account.whitelist || [];
account.blacklist = account.blacklist || [];
export const position = session ? session.positions.curBoard : ModerationLevel.notLoggedIn;
export const anyposition = session ? session.positions.curBoard : ModerationLevel.notLoggedIn;

export function isModerator(): boolean {
  return position >= ModerationLevel.moderator;
}

export function isPowerUser(): boolean {
  return anyposition >= ModerationLevel.janitor;
}

interface IdentityProps {
  modal: AccountPanel;
}

interface IdentityState extends AccountSettings {
  saving: boolean;
  moving: string;
  values: any;
  showPicker: boolean;
  showWarning: boolean;
}


class IdentityTab extends Component<IdentityProps, IdentityState> {
  state = {
    ...account,
    whitelist: account.whitelist.slice(),
    blacklist: account.blacklist.slice(),
    saving: false,
    moving: "",
    values: {
      hue: 0,
      saturation: 0,
      brightness: 0,
    },
    showPicker: false,
    showWarning: false,
  };
  public baseX = 0;
  public colorEl = null as HTMLElement;
  public componentDidMount() {
    document.addEventListener('mousedown', this.handleGlobalDown)
    document.addEventListener('mousemove', this.handleGlobalMove)
    document.addEventListener('mouseup', this.handleGlobalUp)
    this.degenerateColor()
  }
  public componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleGlobalDown)
    document.removeEventListener('mousemove', this.handleGlobalMove)
    document.removeEventListener('mouseup', this.handleGlobalUp)
  }
  public render({ }, {
    name, showName, color, ignoreMode, includeAnon, whitelist, blacklist,
    saving,
  }: IdentityState) {
    const { values, showPicker, showWarning } = this.state;
    const { hue, saturation, brightness, } = values;
    return (
      <div class="account-identity-tab-inner">
        {showPicker && <div class="color-picker">
          <div class="name-preview_container">
            <div style={{ color: '#' + color }} class="name-preview name-preview_light">{name}</div>
            <div style={{ color: '#' + color }} class="name-preview name-preview_dark">{name}</div>
          </div>
          <div
            ref={s(this, "colorEl")}
            class="color-selector_container">
            <div class="color-selector color-selector_inner-container">
              <div class="color-selector color-selector_hue"></div>
              <div class="color-picker_cursor_container">
                <div data-sel="hue" style={{ left: hue }} class="color-picker_cursor"></div>
              </div>
            </div>
            <div class="color-selector color-selector_inner-container">
              <div class="color-selector color-selector_saturation"></div>
              <div class="color-picker_cursor_container">
                <div data-sel="saturation" style={{ left: saturation }} class="color-picker_cursor"></div>
              </div>
            </div>
            <div class="color-selector color-selector_inner-container">
              <div class="color-selector color-selector_brightness"></div>
              <div class="color-picker_cursor_container">
                <div data-sel="brightness" style={{ left: brightness }} class="color-picker_cursor"></div>
              </div>
            </div>
          </div>
          {showWarning && <div class="contrast-warning">{_("Increase contrast")}</div>}
        </div>}
        <article class="account-form-section">
          <h3 class="account-form-shead">{_("Show name")}</h3>
          <div class="account-form-sbody">
            <input
              class="account-form-checkbox option-checkbox"
              type="checkbox"
              checked={showName}
              disabled={saving}
              onChange={this.handleShowNameToggle}
            />
            <input
              class="account-form-name"
              type="text"
              placeholder={_("Name")}
              value={name}
              disabled={saving}
              onInput={this.handleNameChange}
            />
          </div>
        </article>
        <article class="account-form-section">
          <h3 class="account-form-shead">{_("Hex Color")}</h3>
          <div class="account-form-sbody">
            <span
              onClick={() => this.setState({ showPicker: !showPicker })}
              class="pick-color"
            >
              <i class="fa fa-eyedropper" />
            </span>
            <input
              onFocus={() => this.setState({ showPicker: true })}
              class="account-form-color"
              type="text"
              placeholder={_("Color")}
              value={color}
              disabled={saving}
              onInput={this.handleColorChange}
            />

          </div>
        </article>
        <article class="account-form-section">
          <h3 class="account-form-shead">{_("Ignore mode")}</h3>
          <div class="account-form-sbody">
            <select
              class="account-form-ignoremode option-select"
              value={ignoreMode.toString()}
              disabled={saving}
              onChange={this.handleIgnoreModeChange}
            >
              <option value={IgnoreMode.disabled.toString()}>
                {_("No ignore")}
              </option>
              <option value={IgnoreMode.byBlacklist.toString()}>
                {_("Hide blacklisted")}
              </option>
              <option value={IgnoreMode.byWhitelist.toString()}>
                {_("Show whitelisted")}
              </option>
            </select>
          </div>
        </article>
        <article class="account-form-section account-form-section_row">
          <article class="account-form-section">
            <h3 class="account-form-shead">{_("Whitelist")}</h3>
            <MemberList
              members={whitelist}
              disabled={saving}
              onChange={this.handleWhitelistChange}
            />
          </article>
          <article class="account-form-section">
            <h3 class="account-form-shead">{_("Blacklist")}</h3>
            <MemberList
              members={blacklist}
              disabled={saving}
              onChange={this.handleBlacklistChange}
            />
          </article>
        </article>
        <article class="account-form-section">
          <div class="account-form-sbody">
            <label class={cx("option-label", saving && "option-label_disabled")}>
              <input
                class="account-form-checkbox option-checkbox"
                type="checkbox"
                checked={includeAnon}
                disabled={saving}
                onChange={this.handleIncludeAnonToggle}
              />
              {_("Including anonymous")}
            </label>
          </div>
        </article>
        <button class="button account-save-button" disabled={saving || showWarning} onClick={this.handleSave}>
          <i class={cx("account-save-icon fa", {
            "fa-spinner fa-pulse fa-fw": saving,
            "fa-check-circle": !saving,
          })} />
          {_("Save")}
        </button>
      </div>
    );
  }

  private handleBlur = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(COLOR_PICKER_SEL) && !target.closest('.account-form-color')
      && !target.closest('.pick-color')) {
      this.setState({ showPicker: false })
    }
  }

  private getLinearRGB = (n: number) => {
    if (n > 0.03928) return Math.pow(((n + 0.055) / 1.055), 2.4);
    return n / 12.92;
  }

  private getLuma = (r: number, g: number, b: number) => {
    return 0.2126*r + 0.7152 * g + 0.0722 * b;
  }

  private getRatio = (L1: number, L2: number) => {
    if (L1 >= L2) return (L1 + 0.05) / (L2 + 0.05);
    return (L2 + 0.05) / (L1 + 0.05);
  }

  private checkContrast = (color: string) => {
    let [r, g, b] = convert.hex.rgb(color)
    let [r1, g1, b1] = convert.hex.rgb("eef0f2")
    let [r2, g2, b2] = convert.hex.rgb("37383b")
    r = this.getLinearRGB(r / 255);
    g = this.getLinearRGB(g / 255);
    b = this.getLinearRGB(b / 255);
    r1 = this.getLinearRGB(r1 / 255);
    g1 = this.getLinearRGB(g1 / 255);
    b1 = this.getLinearRGB(b1 / 255);
    r2 = this.getLinearRGB(r2 / 255);
    g2 = this.getLinearRGB(g2 / 255);
    b2 = this.getLinearRGB(b2 / 255);
    const L = this.getLuma(r, g, b);
    const L1 = this.getLuma(r1, g1, b1);
    const L2 = this.getLuma(r2, g2, b2);
    let contrast;
    contrast = this.getRatio(L, L1);
    if (contrast < CONTRAST_RATIO) return false;
    contrast = this.getRatio(L, L2);
    if (contrast < CONTRAST_RATIO) return false;
    return true;
  }

  private convertColor = (hsb: any) => {
    const { hue, saturation, brightness } = hsb;
    let h = 360 * (hue / (246 / 100)) * 0.01;
    let s = saturation / (246 / 100);
    let b = brightness / (246 / 100);
    h = Math.round(h)
    s = Math.round(s)
    b = Math.round(b)
    const col = [h, s, b] as any;
    return col;
  }

  private generateColor = (hsb: any) => {
    const col = this.convertColor(hsb)
    const color = convert.hsl.hex(col)
    const contrastOK = this.checkContrast(color) && this.state.values.brightness > 50;
    this.setState({ color, values: hsb })

    if (contrastOK) this.setState({ showWarning: false })
    if (!contrastOK) this.setState({ showWarning: true })

  }

  // I know this is not a word
  private degenerateColor = () => {
    const { color } = this.state;
    if (!color) {
      this.setState({ color: '8c8c8c' });
      return;
    };
    const hsl = convert.hex.hsl(color)
    let hue = hsl[0] / 360 * 246;
    let saturation = hsl[1] * (246 / 100);
    let brightness = hsl[2] * (246 / 100);
    hue = Math.round(hue)
    saturation = Math.round(saturation)
    brightness = Math.round(brightness)
    // const color = convert.hsl.hex([h, s, b])
    const values = {
      hue,
      saturation,
      brightness,
    }
    this.setState({ values })
  }

  private handleGlobalDown = (e: MouseEvent) => {
    this.handleBlur(e);
    const target = e.target as HTMLElement;
    const { colorEl } = this;
    if (!colorEl) return;
    const { clientX } = e;
    if (target.closest(COLOR_PICKER_CURSOR)) {
      const { sel } = target.dataset;
      const { values } = this.state;
      const { left } = colorEl.getBoundingClientRect()
      this.baseX = (clientX - left) - 1;
      values[sel] = this.fixBoundaries(this.baseX)
      this.generateColor(values);
      this.setState({ moving: sel })
    }
  }
  private handleGlobalMove = (e: MouseEvent) => {
    const { moving, values } = this.state;
    if (!moving) return;
    const { colorEl } = this;
    const { clientX } = e;
    const { left } = colorEl.getBoundingClientRect()
    this.baseX = (clientX - left) - 1;
    values[moving] = this.fixBoundaries(this.baseX);
    this.generateColor(values)
  }
  private handleGlobalUp = (e: MouseEvent) => {
    this.setState({ moving: "" })
  }

  private fixBoundaries = (val: number) => {
    if (val < 0) return 0;
    if (val > 246) return 246;
    return val;
  }


  private handleShowNameToggle = (e: Event) => {
    e.preventDefault();
    const showName = !this.state.showName;
    this.setState({ showName });
  }
  private handleNameChange = (e: Event) => {
    // TODO(Kagami): Validate name properly.
    const name = (e.target as HTMLInputElement).value;
    this.setState({ name });
  }
  private handleColorChange = (e: Event) => {
    let color = (e.target as HTMLInputElement).value;
    color = color.replace(/[^0-9a-fA-F]/g, "");
    color = color.substr(1).toUpperCase();
    this.setState({ color }, () => {
      this.degenerateColor();
      this.generateColor(this.state.values);
    });
  }
  private handleIgnoreModeChange = (e: Event) => {
    const ignoreMode = +(e.target as HTMLInputElement).value;
    this.setState({ ignoreMode });
  }
  private handleWhitelistChange = (whitelist: string[]) => {
    this.setState({ whitelist });
  }
  private handleBlacklistChange = (blacklist: string[]) => {
    this.setState({ blacklist });
  }
  private handleIncludeAnonToggle = (e: Event) => {
    e.preventDefault();
    const includeAnon = !this.state.includeAnon;
    this.setState({ includeAnon });
  }
  private handleSave = () => {

    const s = this.state;
    let color
    if (s.color) {
      color = s.color.trim();
      color = s.color.replace(/[^0-9a-fA-F]/g, "");
      const len = color.length;
      if (len !== 6) color = "8c8c8c";
    } else {
      color = "8c8c8c"
    }
    const settings = {
      ...account,
      name: s.name,
      color,
      showName: s.showName,
      ignoreMode: s.ignoreMode,
      includeAnon: s.includeAnon,
      whitelist: s.whitelist,
      blacklist: s.blacklist,
    };
    this.setState({ saving: true });
    API.account.setSettings(settings)
      .then(() => {
        Object.assign(account, settings);
        this.props.modal.hide();
      }, showSendAlert)
      .then(() => {
        this.setState({ saving: false });
      });
  }
}

interface IgnoreState {
  target?: Element;
  shown: boolean;
  left: number;
  top: number;
  userID: string;
  savingWL: boolean;
  savingBL: boolean;
  whitelist: string[];
  blacklist: string[];
}

class IgnoreModalBase extends Component<{}, IgnoreState> {
  public state: IgnoreState = {
    target: null,
    shown: false,
    left: 0,
    top: 0,
    userID: "",
    savingWL: false,
    savingBL: false,
    whitelist: [],
    blacklist: [],
  };
  public get saving() {
    return this.state.savingWL || this.state.savingBL;
  }
  public get wled() {
    return this.state.whitelist.includes(this.state.userID);
  }
  public get bled() {
    return this.state.blacklist.includes(this.state.userID);
  }
  public componentDidMount() {
    hook(HOOKS.openIgnoreModal, this.show);
  }
  public componentWillUnmount() {
    unhook(HOOKS.openIgnoreModal, this.show);
  }
  public render({ }, { shown, left, top, userID, savingWL, savingBL }: IgnoreState) {
    if (!shown) return null;
    const style = { left, top };
    return (
      <div
        class={cx("ignore-modal", {
          "ignore-modal_saving": this.saving,
          "ignore-modal_wled": this.wled,
          "ignore-modal_bled": this.bled,
        })}
        style={style}
        onClick={this.handleModalClick}
      >
        <div class="ignore-modal-info">
          {userID}
        </div>
        <div class="ignore-modal-item" onClick={this.addToWhitelist}>
          <i class={cx("ignore-save-icon control fa", {
            "fa-spinner fa-pulse fa-fw": savingWL,
            "fa-check-circle": !savingWL,
          })} />
          <span> {_(this.wled ? "From whitelist" : "To whitelist")}</span>
        </div>
        <div class="ignore-modal-item" onClick={this.addToBlacklist}>
          <i class={cx("ignore-save-icon control fa", {
            "fa-spinner fa-pulse fa-fw": savingBL,
            "fa-times-circle": !savingBL,
          })} />
          <span> {_(this.bled ? "From blacklist" : "To blacklist")}</span>
        </div>
      </div>
    );
  }
  public onBackgroundClick = (e: MouseEvent) => {
    if (e.target === this.state.target) return;
    if (this.state.shown) {
      this.hide();
    }
  }
  public onEscapePress = () => {
    this.hide();
  }
  private show = (target: Element) => {
    if (target === this.state.target) {
      this.hide();
      return;
    }
    const post = getModel(target);
    if (post.userID === session.userID) return;
    let { left, top } = target.getBoundingClientRect();
    left += window.pageXOffset;
    top += window.pageYOffset + 20;
    this.setState({
      shown: true,
      target, left, top,
      userID: post.userID,
      whitelist: account.whitelist.slice(),
      blacklist: account.blacklist.slice(),
    });
  }
  private hide = () => {
    if (this.saving) return;
    this.setState({ target: null, shown: false });
  }
  private handleModalClick = (e: Event) => {
    e.stopPropagation();
  }
  private addToWhitelist = () => {
    if (this.saving) return;
    const { userID, whitelist, blacklist } = this.state;
    if (this.wled) {
      remove(whitelist, userID);
    } else {
      remove(blacklist, userID);
      whitelist.push(userID);
    }
    const settings = { ...account, whitelist, blacklist };
    this.setState({ savingWL: true });
    API.account.setSettings(settings)
      .then(() => {
        Object.assign(account, settings);
        this.setState({ savingWL: false }, this.hide);
      }, (err) => {
        showSendAlert(err);
        this.setState({ savingWL: false });
      });
  }
  private addToBlacklist = () => {
    if (this.saving) return;
    const { userID, whitelist, blacklist } = this.state;
    if (this.bled) {
      remove(blacklist, userID);
    } else {
      remove(whitelist, userID);
      blacklist.push(userID);
    }
    const settings = { ...account, whitelist, blacklist };
    this.setState({ savingBL: true });
    API.account.setSettings(settings)
      .then(() => {
        Object.assign(account, settings);
        this.setState({ savingBL: false }, this.hide);
      }, (err) => {
        showSendAlert(err);
        this.setState({ savingBL: false });
      });
  }
}

const IgnoreModal = EscapePressMixin(BackgroundClickMixin(IgnoreModalBase));

// Terminate the user session(s) server-side and reset the panel
async function logout(url: string) {
  const res = await fetch(url, {
    credentials: "include",
    method: "POST",
  });
  switch (res.status) {
    case 200:
    case 403: // Does not really matter, if the session already expired
      location.reload(true);
    default:
      showAlert(await res.text());
  }
}

// Account login and registration.
class AccountPanel extends TabbedModal {
  constructor() {
    super(
      document.querySelector(".account-modal"),
      document.querySelector(".header-account-icon"),
    );
    this.onClick({
      "#logout": () => logout("/api/logout"),
      "#logoutAll": () => logout("/api/logout/all"),
      "#changePassword": this.loadConditional(PasswordChangeForm),
      "#createBoard": this.loadConditional(BoardCreationForm),
      "#configureServer": this.loadConditional(ServerConfigForm),
    });
  }

  protected tabHook(el: Element) {
    if (el.classList.contains("account-identity-tab")) {
      el.innerHTML = "";
      render(<IdentityTab modal={this} />, el);
    }
  }

  // Create handler for dynamically loading and rendering conditional
  // view modules.
  private loadConditional(m: Constructable): EventListener {
    return () => {
      this.toggleContent(false);
      // tslint:disable-next-line:no-unused-expression
      new m();
    };
  }
}

export let accountPanel: AccountPanel = null;

function getModelByEvent(e: Event): Post {
  return getModel(e.target as Element);
}

function deletePost(post: Post, force?: boolean) {
  if (!force && !confirm(_("delConfirm"))) return;
  API.post.delete([post.id]).then(() => {
    // In thread we should delete on WebSocket event.
    if (!page.thread) {
      post.setDeleted();
    }
  }, showAlert);
}

function banUser(post: Post) {
  if (!confirm(_("banConfirm"))) return;
  /* const YEAR = 365 * 24 * 60; */
  const MONTH = 31 * 24 * 60;
  API.user.banByPost({
    // Hardcode for now.
    duration: MONTH,
    global: position >= ModerationLevel.admin,
    ids: [post.id],
    reason: "default",
  }).then(() => {
    deletePost(post, true);
  }).catch(showAlert);
}

export function init() {
  accountPanel = new AccountPanel();
  if (position === ModerationLevel.notLoggedIn) {
    // tslint:disable-next-line:no-unused-expression
    new LoginForm("login-form", "login");
    const registrationForm = new LoginForm("registration-form", "register");
    validatePasswordMatch(registrationForm.el, "password", "repeat");
  }
  if (position > ModerationLevel.notLoggedIn) {
    const container = document.querySelector(MODAL_CONTAINER_SEL);
    if (container) {
      render(<IgnoreModal />, container);
      on(document, "click", (e) => {
        trigger(HOOKS.openIgnoreModal, e.target);
      }, { selector: TRIGGER_IGNORE_USER_SEL });
    }
  }
  if (position >= ModerationLevel.moderator) {
    on(document, "click", (e) => {
      deletePost(getModelByEvent(e));
    }, { selector: TRIGGER_DELETE_POST_SEL });

    on(document, "click", (e) => {
      banUser(getModelByEvent(e));
    }, { selector: TRIGGER_BAN_BY_POST_SEL });
  }
}
