/**
 * Expand media attachments to the middle of the screen.
 */

import * as cx from "classnames";
import { Component, h, render } from "preact";
import options from "../options";
import { getModel, posts } from "../state";
import { HOOKS, on, setter as s, trigger, mod } from "../util";
import {
  POPUP_CONTAINER_SEL,
  POST_EMBED_INSTAGRAM_SEL,
  POST_EMBED_SEL,
  POST_FILE_THUMB_BG_SEL,
  POST_FILE_THUMB_SEL,
  TRIGGER_MEDIA_POPUP_SEL,
  ZOOM_STEP_PX,
  POST_EMBED_TWITTER_SEL,
  isMobile,
} from "../vars";
import { findPreloadImages } from "./hover";
import RenderVideo from './player'
import SmileBox from "./smile-box";
import { reactToPost } from "../connection/synchronization";
// import { recalcPosts } from ".";
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
  audioFile: boolean;
  embed: boolean;
  instagram?: boolean;
  twitter?: boolean;
  transparent: boolean;
  blur: string;
  postId: number;
  url: string;
  html: string;
  width: number;
  height: number;
  duration: number;
  onChangeImage: (arg0: number) => void;
  onClose: () => void;
}

export interface PopupState {
  left: number;
  translateX: number;
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
  private left = 0;
  private timeout = null as any;

  constructor(props: PopupProps) {
    super(props);

    const { width, height, twitter } = props;
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
      top: isMobile && twitter ? 0 : rect.top,
      width: rect.width,
      height: rect.height,
      moving: false,
      translateX: 0,
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
    const { twitter } = this.props;
    const { muted } = options;
    this.setState({ muted });
    opened.add(this.props.url);
    trigger(HOOKS.openPostPopup);
    document.addEventListener("keydown", this.handleGlobalKey);
    document.addEventListener("mousemove", this.handleGlobalMove);
    document.addEventListener("touchend", this.handleMouseUp);
    document.addEventListener("click", this.handleGlobalClick);
    if (this.props.video || this.props.record) {
      this.itemEl.volume = options.volume;
      this.itemEl.src = this.props.url;
    }
    if (twitter) this.initTwitter();
    this.left = this.state.left;
  }

  public componentWillUnmount() {
    this.itemEl = null;
    opened.delete(this.props.url);
    document.removeEventListener("keydown", this.handleGlobalKey);
    document.removeEventListener("mousemove", this.handleGlobalMove);
    document.removeEventListener("touchend", this.handleMouseUp);
    document.removeEventListener("click", this.handleGlobalClick);
  }

  componentDidUpdate() {
    const { twitter } = this.props;
    const { moving, resizing } = this.state;
    if (!twitter || moving || resizing) return;
    this.initTwitter();
  }

  shouldComponentUpdate() {
    const { twitter } = this.props;
    if (!twitter) return true;
    return false;
  }

  public render({ video, record, embed, instagram, twitter }: PopupProps, { left, top }: PopupState) {
    let cls = "";
    const { translateX } = this.state;
    const transform = isMobile ? `translateX(${translateX}px)` : '';
    let fn = null;
    if (video) {
      cls = "popup_video";
      fn = this.renderVideo;
    } else if (record) {
      cls = "popup_record";
      // fn = this.renderRecord;
      fn = this.renderVideo;
    } else if (twitter) {
      cls = "popup_embed popup_embed_twitter";
      fn = this.renderTwitter;
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
      <div class={cx("popup", cls)} style={{ left, top, transform }}>
        {fn.call(this)}
        {embed ? this.renderControls() : null}
        {video && isMobile ? this.renderControls() : null}
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
        setRef={(itemEl: HTMLVideoElement) => (this.itemEl = itemEl)}
      />
    );
  }

  private renderImage() {
    const { transparent, postId, url } = this.props;
    const { width, height, showBG } = this.state;
    const thumbUrl = url.replace(/src/, "blur").replace(/png/, "jpg");
    const isGif = (/gif/).test(thumbUrl);
    const backgroundImage = (transparent || !showBG || isGif) ? '' : `url(${thumbUrl})`;
    const onImageLoad = () => {
      this.preload(url, postId);
      this.setState({ showBG: false });
    }
    // https://github.com/developit/preact/issues/663
    return (
      <img
        class="popup-item"
        ref={s(this, "itemEl")}
        style={{ width, height, backgroundImage }}
        src={url}
        onLoad={onImageLoad}
        draggable={0 as any}
        onDragStart={this.handleMediaDrag}
        onMouseDown={this.handleMediaDown}
        onWheel={this.handleMediaWheel}
        onTouchMove={this.handleGlobalMove}
        onTouchStart={this.handleMediaDown}
        onTouchEnd={this.handleMouseUp}
      />
    );
  }

  handleMouseUp = (e: TouchEvent) => {
    if (!isMobile) return;
    // this.handleTouchSwipe(e)
    this.setState({ moving: false, left: this.left, translateX: 0 })
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

  public initTwitter = () => {
    const twttr = (window as any).twttr;
    clearTimeout(this.timeout);
    const element = document.querySelectorAll('.popup_embed_twitter');
    twttr.events.bind('rendered', (e: any) => {
      const { clientWidth, clientHeight } = e.target;
      const { left, top } = getCenteredRect({ height: clientHeight, width: clientWidth })
      // TODO: Super dumb
      if (e.target.nodeName === 'TWITTER-WIDGET') {
        const { parentElement } = e.target;
        parentElement.style.left = `${left}px`;
        parentElement.style.top = `${top}px`;
      }
    }
    );
    twttr.widgets.load(element);
    if (isMobile) this.setState({ top: 0 })
  }

  private renderTwitter() {
    // const { height } = this.state;
    const { width, url } = this.props;
    const widthNew = isMobile ? '100vw' : width;
    // const pointerEvents = moving || resizing ? "none" : "auto";
    return (
      <blockquote
        style={{ width: widthNew, height: 200 }}
        data-conversation="none"
        data-dnt="true"
        class="twitter-tweet popup-item">
        <a href={url}></a>
      </blockquote>

      // <div style={{ width: widthNew }} dangerouslySetInnerHTML={{ __html: html }} class="popup-item">

      // </div>
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
    // if (e.keyCode === 27) {
    //   this.props.onClose();
    // this.setState({ fullscreen: false });
    // }
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

  private handleMediaDown = (e: MouseEvent | TouchEvent) => {
    const { targetTouches } = (e as TouchEvent);
    if ((e as MouseEvent).button !== 0 && !targetTouches) return;
    this.setState({ moving: true });
    const clientX = targetTouches ? targetTouches[0].clientX : (e as MouseEvent).clientX;
    this.baseX = clientX;
    this.baseY = (e as MouseEvent).clientY;
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

  handleTouchSwipe = (n: number) => {
    if (!this.state.moving) return;
    if (isMobile) {
      if (Math.abs(n) > 60) {
        const { onChangeImage } = this.props;
        this.setState({ moving: false })
        const right = n < 0;
        onChangeImage({ left: !right, right } as any)
      };
    }
  }

  private handleGlobalMove = (e: MouseEvent | TouchEvent) => {
    const { targetTouches } = (e as TouchEvent);
    const clientX = targetTouches ? targetTouches[0].clientX : (e as MouseEvent).clientX;
    const { moving, resizing } = this.state;

    if (!moving && !resizing) return;
    e.preventDefault();


    if (moving) {
      if (isMobile) {
        const translateX = clientX - this.baseX;
        this.setState({ translateX })
        return this.handleTouchSwipe(translateX);
      };
      const left = this.startX + clientX - this.baseX;
      const top = this.startY + (e as MouseEvent).clientY - this.baseY;
      this.setState({ left, top });
    } else if (resizing) {
      const dx = ((e as MouseEvent).clientX) - this.baseX;
      const dy = (e as MouseEvent).clientY - this.baseY;
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
    if ((e.button === 0 || isMobile)) {
      if (this.state.moving && ((!this.props.video) || !isMobile)) {
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

    const order = e.deltaY < 0 ? 1 : -1;
    // order = -1 � scale down
    // order = 1 � scale up
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

  public index = 0;
  public files = [] as any[];
  public curElement = null as HTMLElement;

  public componentDidMount() {
    on(document, "click", this.open, {
      selector: TRIGGER_MEDIA_POPUP_SEL,
    });
    on(document, "click", this.open, {
      selector: POST_FILE_THUMB_BG_SEL,
    });
    document.addEventListener('keydown', this.handleKey);
  }

  public handleKey = (e: KeyboardEvent) => {
    const { key } = e;
    const left = key === 'ArrowLeft';
    const right = key === 'ArrowRight';
    const { popups } = this.state;
    if (e.keyCode === 27) {
      const lastPopup = popups[popups.length - 1];
      if (!lastPopup) return;
      this.makeHandleClose(lastPopup.url)();
      return;
    }

    this.handleChangeImage({ left, right });

  }

  handleChangeImage = ({ left, right }: any) => {
    const { popups } = this.state;
    const activeElement = document.activeElement.tagName.toLowerCase();

    if (!left && !right) return;
    if (activeElement === 'input' || activeElement === 'textarea') return;

    if (!popups.find(p => p.video || p.image)) return;
    this.initFileList(() => {
      const getNextElement = (n: number) => {
        const index = mod(this.index + n, this.files.length);
        return this.files[index];
      };
      let pos = 0;
      if (left) pos = -1
      if (right) pos = +1
      this.handlePreloadNext(getNextElement(pos*2))
      this.handleOpen(getNextElement(pos), true);
    })
  }

  handlePreloadNext = (target: HTMLElement) => {
    // if (isMobile) return;
    if (target.hasAttribute('preloaded')) return;
    target.setAttribute('preloaded', '')

    const post = getModel(target);
    this.curElement = target as HTMLElement;
    const { sha1 } = (target as HTMLImageElement).dataset;
    const file = post.getFileByHash(sha1);
    if (file.video) {
      let vid = document.createElement('video');
      vid.onloadedmetadata = () => vid = null;
      vid.src = file.src;
      vid.preload = "metadata"
      return;
    };

    let img = document.createElement('img');
    img.onload = () => img = null;
    img.src = file.src;

  }

  public initFileList = (callback?: () => void) => {
    const { curElement } = this;
    this.files = [...document.querySelectorAll(".post-file-thumb:not(.fa-music)")];
    this.index = this.files.indexOf(curElement);
    if (callback) callback();
  }

  public render({ }, { popups }: PopupsState) {
    return (
      <div class="popup-container-inner">
        {popups.map((props) => (
          <Popup
            onChangeImage={this.handleChangeImage}
            {...props}
            key={props.url}
            onClose={this.makeHandleClose(props.url)}
          />
        ))}
      </div>
    );
  }

  public handleOpen(target: HTMLElement, omitSameSkip = false) {
    const props = {
      video: false,
      image: false,
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
    let { popups } = this.state;

    const isThumbBG = target.matches(POST_FILE_THUMB_BG_SEL);
    const IS_FILE = target.matches(POST_FILE_THUMB_SEL) || isThumbBG;
    const IS_EMBED = target.matches(POST_EMBED_SEL);
    const IS_EMBED_INSTAGRAM = target.matches(POST_EMBED_INSTAGRAM_SEL);
    const IS_TWEET = target.matches(POST_EMBED_TWITTER_SEL);
    // const IS_AUDIO = target.closest('.post-file_record');

    if (IS_FILE) {
      if (isThumbBG) target = target.parentElement.firstElementChild as HTMLElement;
      const post = getModel(target);
      this.curElement = target as HTMLElement;
      const { sha1 } = (target as HTMLImageElement).dataset;
      const file = post.getFileByHash(sha1);

      Object.assign(props, {
        video: file.video,
        image: !file.video,
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
    } else if (IS_EMBED) {
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

    if (IS_EMBED_INSTAGRAM) props.instagram = true;
    if (IS_TWEET) {
      props.twitter = true;
      props.height = 500;
    };
    const isAudioFile = props.record;

    if (isAudioFile) {
      props.width = 250;
      props.height = 40;
      props.image = false;
      props.audioFile = true;
    }

    // if (props.video) {
    //   let { width, height } = props;
    //   props.width = Math.max(width, 400);
    //   props.height = Math.max(height, 400);
    // }

    const isVisualFile = props.image || props.video;

    const hasSameFile = popups.find(p => p.url == props.url);

    if (hasSameFile && !omitSameSkip) {
      popups = popups.filter(p => p.url !== props.url)
    }

    if (!hasSameFile) {
      if (isVisualFile) popups = popups.filter(p => !p.video && !p.image)
      if (isAudioFile) popups = popups.filter(p => !p.record)
      popups = popups.concat(props)
    };

    this.setState({ popups });
    this.initFileList();
  }

  public makeHandleClose(url: string) {
    return () => {
      let { popups } = this.state;
      popups = popups.filter((p) => p.url !== url);
      this.setState({ popups });
    };
  }
  private open = (e: Event) => {
    let target = e.target as HTMLElement;
    if (!target.matches) return;
    if ((e as MouseEvent).button !== 0) return;
    e.preventDefault();
    this.handleOpen(target);
  }

}

export function init() {
  const container = document.querySelector(POPUP_CONTAINER_SEL);
  if (container) {
    render(<Popups />, container);
  }
}

export function handleNewReaction(postId: string, buttonElement: HTMLElement) {
  const container = document.body;
  let element: Element = null;
  if (container) {
    element = render(
      <SmileBox
        positionElement={buttonElement}
        onSelect={handleSelect}
        onClose={handleClose}
      />,
      container);
  }
  function handleClose() {
    element.remove();
  }
  function handleSelect(smileName: string) {
    handleClose();
    reactToPost(smileName, postId);

    // Preemptively Increase Counter
    const post = posts.get(parseInt(postId, 10));
    if (post && !post.deleted) {
      post.setReaction({
        count: 1,
        postId: parseInt(postId, 10),
        smileName,
      });
    }
  }
}
