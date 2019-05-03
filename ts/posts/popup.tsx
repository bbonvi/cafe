/**
 * Expand media attachments to the middle of the screen.
 */

import * as cx from "classnames";
import { Component, h, render } from "preact";
import options from "../options";
import { getModel } from "../state";
import { HOOKS, on, setter as s, trigger } from "../util";
import {
  POPUP_CONTAINER_SEL,
  POST_EMBED_INSTAGRAM_SEL,
  POST_EMBED_SEL,
  POST_FILE_THUMB_BG_SEL,
  POST_FILE_THUMB_SEL,
  TRIGGER_MEDIA_POPUP_SEL,
  ZOOM_STEP_PX,
} from "../vars";
import { findPreloadImages } from "./hover";
import RenderVideo from './player'
const opened: Set<string> = new Set();


export function isOpen(url: string): boolean {
  return opened.has(url);
}

export function getCenteredRect({ width, height }: any) {
  const aspect = width / height;
  const pW = document.body.clientWidth;
  const pH = window.innerHeight;
  width = Math.min(width, pW);
  height = Math.ceil(width / aspect);
  if (height > pH) {
    height = pH;
    width = Math.ceil(height * aspect);
  }
  const left = (pW - width) / 2;
  const top = (pH - height) / 2;
  return { width, height, left, top };
}

export interface PopupProps {
  video: boolean;
  image: boolean;
  audio: boolean;
  record: boolean;
  embed: boolean;
  instagram?: boolean;
  transparent: boolean;
  blur: string;
  postId: number;
  url: string;
  html: string;
  width: number;
  height: number;
  duration: number;
  onClose: () => void;
}

export interface PopupState {
  left: number;
  top: number;
  width: number;
  height: number;
  moving: boolean;
  seeking: boolean;
  resizing: boolean;
  curTime?: number;
  seekPosition?: number;
  seekHover?: boolean;
  pause?: boolean;
  muted?: boolean;
  volume?: number;
  fullscreen?: boolean;
  minimized?: boolean;
  duration?: number;
  nextWheelEdge?: boolean;
  mult?: number;
  showBG: boolean;
  playbackRateShow: boolean;
  playbackRate: number;
}

class Popup extends Component<PopupProps, PopupState> {
  private itemEl = null as HTMLVideoElement;
  private frameUrl = "";
  private aspect = 0;
  private baseX = 0;
  private baseY = 0;
  private startX = 0;
  private startY = 0;
  private startW = 0;
  private startH = 0;

  constructor(props: PopupProps) {
    super(props);

    const { width, height } = props;
    const rect = getCenteredRect({ width, height });
    this.aspect = width / height;

    if (props.embed) {
      const matchSrc = props.html.match(/src="(.*)"/);
      if (matchSrc && !matchSrc[1].match(/instagram/)) {
        this.frameUrl = matchSrc[1];
      } else {
        // tslint:disable-next-line:max-line-length
        this.frameUrl = props.url
          .replace(/\?.*$/, "")
          .replace(/#.*$/, "")
          .replace(/\/$/, "")
          .replace(/instagr\.am/, "www.instagram.com");
      }
    }

    this.state = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      moving: false,
      seeking: false,
      resizing: false,
      curTime: 0,
      pause: false,
      volume: options.volume * 100 || 50,
      fullscreen: false,
      minimized: true,
      duration: 0,
      nextWheelEdge: false,
      showBG: true,
      playbackRateShow: false,
      playbackRate: 1,
    };
  }
  public componentDidMount() {
    const { muted } = options;
    this.setState({ muted });
    opened.add(this.props.url);
    trigger(HOOKS.openPostPopup);
    document.addEventListener("keydown", this.handleGlobalKey);
    document.addEventListener("mousemove", this.handleGlobalMove);
    document.addEventListener("click", this.handleGlobalClick);
    if (this.props.video || this.props.record) {
      this.itemEl.volume = options.volume;
      this.itemEl.src = this.props.url;
    }
  }

  public componentWillUnmount() {
    this.itemEl = null;
    opened.delete(this.props.url);
    document.removeEventListener("keydown", this.handleGlobalKey);
    document.removeEventListener("mousemove", this.handleGlobalMove);
    document.removeEventListener("click", this.handleGlobalClick);
  }

  public render({ video, record, embed, instagram }: PopupProps, { left, top }: PopupState) {
    let cls = "";
    let fn = null;
    if (video) {
      cls = "popup_video";
      fn = this.renderVideo;
    } else if (record) {
      cls = "popup_record";
      fn = this.renderRecord;
    } else if (instagram) {
      cls = "popup_embed popup_embed_instagram";
      fn = this.renderEmbedInstagram;
    } else if (embed) {
      cls = "popup_embed";
      fn = this.renderEmbed;
    } else {
      cls = "popup_image";
      fn = this.renderImage;
    }
    return (
      <div class={cx("popup", cls)} style={{ left, top }}>
        {fn.call(this)}
        {embed ? this.renderControls() : null}
      </div>
    );
  }
  private renderVideo() {
    return (
      <RenderVideo
        {...this.props}
        {...this.state}
        realHeight={this.props.height}
        realWidth={this.props.width}
        onMediaWheel={this.handleMediaWheel}
        onMediaDown={this.handleMediaDown}
        onKeyDown={this.handleGlobalKey}
        onMove={this.handleGlobalMove}
        onVolumeChange={this.handleMediaVolume}
        onStateChange={(state: {}) => this.setState({ ...state })} 

        itemEl={this.itemEl}
        // ref={s(this, "itemEl")}
        setRef={(itemEl: HTMLVideoElement) => (this.itemEl = itemEl)}
      />
      );
  // private copyToClipboard = (str: any) => {
  //   const el = document.createElement("textarea");
  //   el.value = str;
  //   document.body.appendChild(el);
  //   el.select();
  //   document.execCommand("copy");
  //   document.body.removeChild(el);
  // }
  }

  private renderImage() {
    const { transparent, postId, url } = this.props;
    const { width, height, showBG } = this.state;
    const thumbUrl = url.replace(/src/, "blur").replace(/png/, "jpg");
    const isGif = (/gif/).test(thumbUrl);
    const backgroundImage = (transparent || !showBG || isGif) ? '' : `url(${thumbUrl})`;
    // const hash = url.replace(/.*src\//, '').replace(/\.\w{1,5}$/, '').replace('/', '')

    // https://github.com/developit/preact/issues/663
    return (
      <img
        class="popup-item"
        ref={s(this, "itemEl")}
        style={{ width, height, backgroundImage }}
        src={url}
        onLoad={() => {
          this.preload(url, postId);
          this.setState({ showBG: false });
        }}
        draggable={0 as any}
        onDragStart={this.handleMediaDrag}
        onMouseDown={this.handleMediaDown}
        onWheel={this.handleMediaWheel}
      />
    );
  }
  private preload(url: string, postId: number): any {
    let preload = document.createElement("img");
    preload.src = url;
    const startTime = new Date().getTime();
    preload.onload = () => {
      const loadtime = new Date().getTime() - startTime;
      if (loadtime < 10000) {
        findPreloadImages(postId);
      }
      preload = null;
    };
  }
  private renderRecord() {
    return (
      <div class="popup-record" onMouseDown={this.handleMediaDown}>
        <i class="popup-record-icon fa fa-music" />
        <audio
          class="popup-item popup-record-item"
          ref={s(this, "itemEl")}
          autoPlay
          controls
          onVolumeChange={this.handleMediaVolume}
        />
      </div>
    );
  }
  private renderEmbed() {
    const { width, height, moving, resizing } = this.state;
    const pointerEvents = moving || resizing ? "none" : "auto";
    return (
      <iframe
        class="popup-item"
        ref={s(this, "itemEl")}
        style={{ width, height, pointerEvents }}
        allowFullScreen
        frameBorder={0}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups"
        src={this.frameUrl}
      />
    );
  }
  private renderEmbedInstagram() {
    const { width, height, moving, resizing } = this.state;
    const pointerEvents = moving || resizing ? "none" : "auto";
    const url = this.frameUrl + "/embed/captioned";
    return (
      <iframe
        class="popup-item instagram-media instagram-media-rendered"
        id="instagram-embed-17"
        // tslint:disable-next-line:max-line-length
        src={url}
        allowTransparency={true}
        frameBorder={0}
        width={width}
        height={height}
        data-instgrm-payload-id="instagram-media-payload-17"
        scrolling="no"
        style={{ pointerEvents }}
      />
    );
  }
  private renderControls() {
    return (
      <div class="popup-controls" onClick={this.handleControlsClick}>
        <a class="control popup-control popup-resize-control" onMouseDown={this.handleResizerDown}>
          <i class="fa fa-expand fa-flip-horizontal" />
        </a>
        <a class="control popup-control popup-move-control" onMouseDown={this.handleMediaDown}>
          <i class="fa fa-arrows" />
        </a>
        <a class="control popup-control popup-close-control" onClick={this.props.onClose}>
          <i class="fa fa-remove" />
        </a>
      </div>
    );
  }

  private handleGlobalKey = (e: KeyboardEvent) => {
    if (e.keyCode === 27) {
      this.props.onClose();
      // this.setState({ fullscreen: false });
    }
  }
  private handleMediaDrag = (e: DragEvent) => {
    // NOTE(Kagami): Note that both draggable AND ondragstart are
    // required:
    // * without draggable Chrome doesn't produce click event after
    //   "mousedown" -> "mousemove" -> "mouseup" for image
    // * draggable attr doesn't seem to be working in Firefox so
    //   dragstart handler required
    e.preventDefault();
  }
  private handleMediaVolume = () => {
    options.volume = this.itemEl.volume;
    options.muted = this.itemEl.muted;
  }
  private handleMediaDown = (e: MouseEvent) => {
    // if (!this.state.minimized || !this.props.video) {
    // if (e.button !== 0) return;
    this.setState({ moving: true });
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.startX = this.state.left;
    this.startY = this.state.top;
    // }
  }
  private handleResizerDown = (e: MouseEvent) => {
    // if (this.isFullscreen) return;
    if (e.button !== 0) return;
    e.preventDefault();
    this.setState({ resizing: true });
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.startX = this.state.left;
    this.startY = this.state.top;
    this.startW = this.state.width;
    this.startH = this.state.height;
  }

  // private handleAutoMinimize = () => {
  //   clearTimeout(this.timer);
  //   this.timer = setTimeout(() => {
  //     this.handleMinimize();
  //   }, 2000);
  // }
  // private handleTouch = () => {
  //   if (!isMobile) return;
  //   this.handleAutoMinimize();
  // }
  private handleGlobalMove = (e: MouseEvent) => {
    // const target = e.target as HTMLElement;
    // if (target.matches(".popup-video-overlay") && !isMobile) {
    //   this.handleMaximize();
    // }
    // if (!target.closest(".popup-video")) {
    //   this.handleMinimize();
    // }
    // clearTimeout(this.timer);
    // this.timer = setTimeout(() => {
    //   if (!target.closest(".popup-player") && !this.state.seeking && !isMobile) {
    //     this.handleMinimize();
    //   }
    // }, 1500);
    // if (this.isFullscreen) return;
    if (this.state.moving) {
      this.setState({
        left: this.startX + e.clientX - this.baseX,
        top: this.startY + e.clientY - this.baseY,
      });
    } else if (this.state.resizing) {
      const dx = e.clientX - this.baseX;
      const dy = e.clientY - this.baseY;
      let left = this.startX + dx;
      let top = this.startY + dy;
      let width = this.startW - dx;
      let height = this.startH - dy;

      const limit = 150;
      if (width < limit) {
        left -= limit - width;
      }
      if (height < limit) {
        top -= limit - height;
      }
      width = Math.max(width, limit);
      height = Math.max(height, limit);

      this.setState({ left, top, width, height });
    }
  }
  private handleControlsClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.setState({ moving: false, resizing: false });
  }
  private handleGlobalClick = (e: MouseEvent) => {
    if (e.button === 0) {
      if (this.state.moving) {
        if (e.clientX === this.baseX && e.clientY === this.baseY) {
          this.props.onClose();
        }
      } else if (this.state.resizing) {
        /* skip */
      }
    }
    this.setState({ moving: false, resizing: false });
  }
  private handleMediaWheel = (e: WheelEvent) => {

    // const { mult } = this.state.mult;
    e.preventDefault();
    const innerHeight = window.innerHeight;
    const innerWidth = window.innerWidth;
    const { clientX, clientY } = e as MouseEvent;
    // console.log(offsetX);

    const order = e.deltaY < 0 ? 1 : -1;
    // order = -1 — scale down
    // order = 1 — scale up
    let zoom = ZOOM_STEP_PX;
    let { left, top, width, height } = this.state;
    let { width: realWidth, height: realHeight } = this.props;

    const rect = this.itemEl.getBoundingClientRect();
    const itemWidth = rect.width;
    const itemHeight = rect.height;
    const itemTop = rect.top;
    const itemLeft = rect.left;

    const offsetX = clientX - itemLeft;
    const offsetY = clientY - itemTop;
    
    const max = (itemHeight * itemWidth - innerHeight * innerWidth) / 1000000;
    if (max > 0) {
        zoom = Number((zoom * (max / (order < 0 ? 8 : 3) + 1)).toFixed(0));
    }

    const relativePositionX = ((itemWidth / 2) / offsetX);
    const relativePositionY = ((itemHeight / 2) / offsetY);

    const isOriginalSize = width === realWidth && height === realHeight;
    if (isOriginalSize && order > 0) return;

    left = left - (zoom / 2 / relativePositionX) * order;
    top = top - (zoom / this.aspect / 2 / relativePositionY) * order;
    width = Math.max(50, width + zoom * order);
    height = Math.ceil(width / this.aspect);

    const isUndersized = width <= 230 || height <= 230;
    
    const isOversized = width > realWidth || height > realHeight;

    if (isUndersized && order < 0) return;
    
    if (isOversized) {
      const offsetWidth = width - this.props.width;
      const offsetHeight = height - this.props.height;
      left = left + offsetWidth / 2 / relativePositionX;
      top = top + offsetHeight / 2 / relativePositionY;
      width = width - offsetWidth;
      height = height - offsetHeight;
    }
    this.setState({ top, left, height, width, seekHover: false })
  }
}

interface PopupsState {
  popups: PopupProps[];
}

export interface ProgressBarProps {
  curTime: number;
  duration: number;
  video: HTMLElement;
}

export interface ProgressBarState {
  position: number;
}

class Popups extends Component<any, PopupsState> {
  public state = {
    popups: [] as PopupProps[],
  };
  public componentDidMount() {
    on(document, "click", this.open, {
      selector: TRIGGER_MEDIA_POPUP_SEL,
    });
    on(document, "click", this.open, {
      selector: POST_FILE_THUMB_BG_SEL,
    });
  }
  public render({ }, { popups }: PopupsState) {
    return (
      <div class="popup-container-inner">
        {popups.map((props) => (
          <Popup {...props} key={props.url} onClose={this.makeHandleClose(props.url)} />
        ))}
      </div>
    );
  }
  private open = (e: Event) => {
    let target = e.target as HTMLElement;
    if (!target.matches) return;
    if ((e as MouseEvent).button !== 0) return;
    e.preventDefault();

    const props = {
      video: false,
      audio: false,
      record: false,
      embed: false,
      transparent: false,
      url: "",
      html: "",
      width: 0,
      height: 0,
      duration: 0,
    } as PopupProps;
    const isThumbBG = target.matches(POST_FILE_THUMB_BG_SEL);
    if (target.matches(POST_FILE_THUMB_SEL) || isThumbBG) {
      if (isThumbBG) target = target.parentElement.firstChild as HTMLElement;
      const post = getModel(target);
      const file = post.getFileByHash((target as HTMLImageElement).dataset.sha1);
      Object.assign(props, {
        video: file.video,
        blur: file.blur || '',
        audio: file.audio,
        record: file.audio && !file.video,
        transparent: file.transparent,
        url: file.src,
        postId: post.id,
        width: file.dims[0] || 200,
        height: file.dims[1] || 200,
        duration: file.length,
      });
    } else if (target.matches(POST_EMBED_INSTAGRAM_SEL)) {
      Object.assign(props, {
        embed: true,
        instagram: true,
        url: (target as HTMLLinkElement).href,
        html: target.dataset.html,
        width: +target.dataset.width,
        height: +target.dataset.height,
      });
    } else if (target.matches(POST_EMBED_SEL)) {
      Object.assign(props, {
        embed: true,
        url: (target as HTMLLinkElement).href,
        html: target.dataset.html,
        width: +target.dataset.width,
        height: +target.dataset.height,
      });
    } else {
      return;
    }
    let { popups } = this.state;
    if (!props.video && !props.embed && !props.record) {
      // const { popups: list } = this.state
      popups = popups.filter((p) => p.video || p.embed || p.record || p.url === props.url);
      // this.setState({ popups })
    }
    if (props.video) {
      // const { popups: list } = this.state
      popups = popups.filter((p) => !p.video || p.url === props.url);
      // this.setState({ popups })
    }
    const was = popups.length;
    popups = popups.filter((p) => p.url !== props.url);
    if (popups.length === was) {
      popups = popups.concat(props);
    }
    this.setState({ popups });
  }
  private makeHandleClose(url: string) {
    return () => {
      let { popups } = this.state;
      popups = popups.filter((p) => p.url !== url);
      this.setState({ popups });
    };
  }
}

export function init() {
  const container = document.querySelector(POPUP_CONTAINER_SEL);
  if (container) {
    render(<Popups />, container);
  }
}
