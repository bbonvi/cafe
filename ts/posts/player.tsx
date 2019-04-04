import * as cx from "classnames";
import { Component, h } from "preact";
import options from "../options";
import { duration as readableDuration } from "../templates";
import { isMobile, FULLSCREEN_CHANGE_SUPPORT } from "../vars";
import { PopupState } from "./popup";
import _ from "../lang";
import { HOOKS, on, trigger } from "../util";

// export interface RenderVideoProps {
//   video: boolean;
//   image: boolean;
//   audio: boolean;
//   record: boolean;
//   embed: boolean;
//   instagram?: boolean;
//   transparent: boolean;
//   blur: string;
//   postId: number;
//   url: string;
//   html: string;
//   width: number;
//   height: number;
//   duration: number;
//   onClose: () => void;
// }
 
export interface RenderVideoState {
  seeking: boolean;
  resizing: boolean;
  curTime?: number;
  seekPosition?: number;
  seekHover?: boolean;
  pause?: boolean;
  volume?: number;
  fullscreen?: boolean;
  minimized?: boolean;
  duration?: number;
  mult?: number;
  showBG: boolean;
}
let timer: any;
class RenderVideo extends Component<any, PopupState> {
  // constructor() {
  //   super()
    // this.state = {
    //   seeking: false,
    //   resizing: false,
    //   curTime: 0,
    //   seekPosition: 0,
    //   seekHover: false,
    //   pause: false,
    //   fullscreen: false,
    //   minimized: false,
    //   duration: 0,
    //   mult: 1,
    //   showBG: true,
    // }
  // }
  private timer = null as any;
  private seekX = 0;
  private seekY = 0;
  public componentDidMount() {
    document.addEventListener("keydown", this.handleGlobalKey);
    document.addEventListener("click", this.handleTouch);
    document.addEventListener("mousemove", this.handleGlobalMove);
    let fullscreenchange;
    switch (FULLSCREEN_CHANGE_SUPPORT()) {
      case 1:
        fullscreenchange = "fullscreenchange";
        break;
      case 2:
        fullscreenchange = "webkitfullscreenchange";
        break;
      case 3:
        fullscreenchange = "mozfullscreenchange";
        break;
      case 4:
        fullscreenchange = "msfullscreenchange";
        break;
      default:
        break;
    }
    document.addEventListener(fullscreenchange, (e: Event) => this.fullscreenChange());
    on(document, "click", () => { this.handleFullscreen() },
      { selector: [".player-fullscreen", ".fa-window-maximize"] },
    );
  }
  render() {
    const {
      curTime,
      pause,
      seekHover,
      seekPosition,
      minimized,
      fullscreen,
      duration
      
    } = this.state;
    const {
      width,
      height,
      blur,
      showBG,
      muted,
      volume,
      itemEl,
      durationProp
    } = this.props;
    const backgroundImage = showBG ? `url(${blur})` : '';
    // console.log('rerendered');
    return (

      <div
        class={cx("popup-video", { fullscreen })}
        onMouseEnter={!isMobile ? this.handleMaximize : null}
      >
        <video
          crossOrigin="use-credential"
          onTimeUpdate={this.setDuration} // use onTimeUpdate for mobile devices
          // onPlay={!isMobile ? this.requestAnimation : null} // use requestAnimationFrame for rest
          // onPlay={true ? null : this.requestAnimation} // use requestAnimationFrame for rest
          class="popup-item popup-video-item"
          ref={this.props.setRef}
          style={{ width, height, backgroundImage }}
          loop
          muted={muted}
          autoPlay
          controls={false}
          onLoadedMetadata={() => {
            this.handleStartPlaying()
            this.props.onStateChange({ showBG: false });
          }}
          onVolumeChange={this.props.handleMediaVolume}
        />
        <div
          class={cx("popup-video-overlay", {
            "popup-video-overlay_full": !this.needVideoControls,
          })}
          onMouseDown={!isMobile ? this.handleMediaDown : null}
          onWheel={this.handleMediaWheel}
          onClick={!isMobile ? null : this.handleMobileMediaTouches}
        />
        <div
          class={cx(
            "popup-player",
            { reduced2x: width < 330 && !fullscreen },
            { reduced3x: width < 270 && !fullscreen },
            { minimized },
            // {minimized: this.props.state.minimized && isMobile},
          )}
          style={this.needVideoControls ? "" : "display: none;"}
          onWheel={this.handleMediaWheel}
          onClick={this.handleMaximize}>
          <div class={"player-controls_container"}>
            <span
              class={cx(
                "player-control player-control_state",
                { "player-control_play": pause },
                { "player-control_pause": !pause },
              )}
              onClick={this.handlePause}
              title={pause ? _("play") : _("pause")}
            >
              <i class={cx("fa", { "fa-play": pause }, { "fa-pause": !pause })} />
            </span>
            <span
              class="player-control player-volume"
              style={!this.props.audio ? "display: none;" : ""}
              onClick={this.mute}>
              <i class={muted ? "fa fa-volume-off" : "fa fa-volume-up"} />
              {muted && <i class="fa fa-times" />}
            </span>
            <span
              class="player-control player-volume slider"
              style={!this.props.audio || isMobile ? "display: none;" : ""}>
              <span class="progress-bar_container player-volume">
                <span class="progress-bar_radius">
                  <span
                    class="progress-bar_full player-volume"
                    style={`width:${volume}%`}
                  />
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={`${volume}`}
                  class="progress-bar_range player-volume"
                  onInput={this.handleVolumeChange}
                />
              </span>
            </span>
            <span class="player-control player-timer">
              <span
                class={"player-timer_current"}>{readableDuration(curTime || 0, true).toString()}
              </span>
              <span class={"player-timer_duration"}>
                {" / "}
                {readableDuration(duration || durationProp, true)}
              </span>
            </span>

            <span
              onMouseMove={!isMobile ? this.handleSeekHover : null}
              onMouseEnter={() => this.setState({ seekHover: true })}
              onMouseLeave={() => this.setState({ seekHover: false })}
              class="player-control progress-bar_container player-seek">
              {seekHover && !isMobile && !minimized && (
                <span
                  class="player-seek_hover"
                  onMouseLeave={() => this.setState({ seekHover: false })}
                  style={{ left: this.seekX - 23, top: this.seekY - 30 }}>
                  {readableDuration(seekPosition, true)}
                </span>
              )}
              <span class="progress-bar_radius">
                {/* <span class="progress-bar_full" style={"width:" + this.curPosition() / 10 + "%"} /> */}
                {itemEl && <ProgressBar pause={pause} video={itemEl} duration={duration}/>}
              </span>
              <input
                type="range"
                min="0"
                max="1000"
                value={this.curPosition()}
                class="progress-bar_range"
                onMouseDown={this.pause}
                onMouseUp={this.play}
                onInput={this.handleSeek}
                onTouchStart={this.seekingOn}
                onTouchEnd={this.seekingOff}
              />
            </span>
            <a
              title={_("download")}
              class="player-control player-download" href={this.props.url + "?download"}>
              <i class="fa fa-download" />
            </a>
            <span
              title={_("snapshot")}
              class="player-control player-snapshot"
              onClick={this.handleSnapshot}>
              <i class="fa fa-camera"></i>
            </span>
            <span
              title={this.isFullscreen() ? _("fullscreenExit") : _("fullscreen")}
              class="player-control player-fullscreen"
            >
              <i class="fa fa-window-maximize" />
            </span>
          </div>
        </div>
      </div>
    );
  }
  private handleSnapshot = async (e: any) => {
    trigger(HOOKS.openReply);
    let canvas = document.createElement("canvas");
    const { realHeight, realWidth } = this.props;
    canvas.width = realWidth;
    canvas.height = realHeight;
    let ctx = canvas.getContext("2d");
    const video = this.props.itemEl;
    ctx.drawImage(video, 0, 0);
    const imgData = canvas.toDataURL("image/png");
    fetch(imgData)
      .then((res) => res.blob())
      .then((blob) => {
        trigger(HOOKS.dropFile, [blob]);
        canvas = null;
        ctx = null;
      });
  }
  private handleSeekHover = (e: any) => {
    const range = e.target;
    const { duration, seekPosition: oldPosition } = this.state;
    const { left, width, top } = range.getBoundingClientRect();
    const mouseOnRange = e.clientX - left;
    this.seekX = e.clientX;
    this.seekY = top;
    const inputPos = mouseOnRange / width;
    const seek = duration * inputPos;
    const seekPosition = Math.round(seek <= 0 ? 0 : seek >= duration ? duration : seek);
    // seekPosition = parseFloat(seekPosition);
    if (oldPosition !== seekPosition) this.setState({ seekPosition });
  }
  private handleMinimize = () => {
    if (!this.state.seeking) this.setState({ minimized: true });
  }
  private handleMaximize = () => {
    const { minimized } = this.state;
    if (minimized) this.setState({ minimized: false });
  }
  private handleFullscreen() {
    if (this.isFullscreen()) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }
  private isFullscreen() {
    const doc = document as any;
    if (doc.fullscreenElement) {
      return true;
    } else if (doc.webkitFullscreenElement) {
      return true;
    } else if (doc.mozFullScreenElement) {
      return true;
    } else return false;
  }
  private exitFullscreen() {
    const doc = document as any;
    if (!doc.fullscreen) return;
    if (doc.exitFullscreen) {
      doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }
  }
  private enterFullscreen() {
    if (!this.props.itemEl) return;
    const popupVideo = this.props.itemEl.parentNode as any;
    if (popupVideo.requestFullscreen) {
      popupVideo.requestFullscreen();
    } else if (popupVideo.mozRequestFullScreen) {
      popupVideo.mozRequestFullScreen();
    } else if (popupVideo.webkitRequestFullscreen) {
      popupVideo.webkitRequestFullscreen();
    }
  }
  private mute = () => {
    const { muted } = this.props;
    this.props.onStateChange({ muted: !muted })
    options.muted = !muted;
  }
  private pause = () => {
    clearTimeout(this.timer);
    if (!this.props.itemEl.paused) {
      this.props.itemEl.pause();
    }
  }
  private play = () => {
    if (!this.state.pause && this.props.itemEl.paused) {
      this.props.itemEl.play();
    }
  }
  private handleVolumeChange = (e: any) => {
    const { onStateChange, itemEl, onVolumeChange } = this.props;
    const { value } = e.target;

    onStateChange({ volume: value, muted: false })
    itemEl.volume = value / 100;
    onVolumeChange()
  }
  private seekingOn = () => {
    if (!this.state.minimized) {
      this.setState({ seeking: true });
      this.pause();
    }
  }
  private seekingOff = () => {
    this.setState({ seeking: false });
    if (!this.state.pause) this.play();
  }
  private handleSeek = (e: any) => {

    const time = (e.target.value / 1000) * this.state.duration;
    this.setState({ curTime: time });
    this.props.itemEl.currentTime = time;
  }
  private curPosition() {
    const { curTime, duration } = this.state;
    let pos: any = Number(((curTime / duration) * 100).toFixed(1)) * 10;
    if (pos > 1000) pos = 1000;
    pos = pos.toString()
    return pos;
  }
  private handlePause = () => {
    const { itemEl } = this.props;
    if (!itemEl) return;
    const pause = itemEl.paused;
    if (itemEl.paused) itemEl.play();
    else itemEl.pause();
    this.setState({ pause: !pause });
  }
  private handleStartPlaying = () => {
    const { itemEl } = this.props;
    if (!itemEl) return;
    let { duration } = itemEl;
    this.setState({ duration, pause: false });
    this.handleAutoMinimize();
  }
  private setDuration = () => {
    const curTime = this.props.itemEl ? this.props.itemEl.currentTime : 0;
    // curTime = Number(curTime.toFixed(3));
    this.setState({ curTime });

    this.curPosition();

  }
  private handleGlobalKey = (e: KeyboardEvent) => {
    if (e.keyCode === 27) {
      this.setState({ fullscreen: false });
      this.props.onKeyDown(e)
    }
  }
  private handleMediaDown = (e: MouseEvent) => {
    // if (!this.state.minimized || !this.props.video) {
    if (this.isFullscreen()) return;
    if (e.button !== 0) return;
    this.props.onMediaDown(e);
    // }
  }
  private handleTouch = () => {
    if (!isMobile) return;
    this.handleAutoMinimize();
  }

  private handleAutoMinimize = () => {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.handleMinimize();
    }, 2000);
  }
  private handleGlobalMove = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const { minimized } = this.state;
    if (target.matches(".popup-video-overlay") && !isMobile) {

      if (minimized) this.handleMaximize();
    }
    if (!target.closest(".popup-video")) {
      if (!minimized) this.handleMinimize();
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!target.closest(".popup-player") && !this.state.seeking && !isMobile) {
        this.handleMinimize();
      }
    }, 1500);
    if (this.isFullscreen()) return;
    this.props.onMove(e);
    
  }
  private handleMobileMediaTouches = (e: MouseEvent) => {
    if (this.state.minimized) {
      this.handleMaximize();
    } else {
      this.props.onClose();
    }
    // const target = e.target as HTMLElement;
    // if (target.matches(".popup-video-overlay")) {
    //   this.handleMaximize();
    // }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!this.state.minimized && !this.state.seeking) {
        this.handleMinimize();
      }
    }, 1500);
  }
  private handleMediaWheel = (e: WheelEvent) => {
    if (this.isFullscreen()) return;
    // e.preventDefault();
    this.props.onMediaWheel(e);
  }
  public fullscreenChange() {
    if (this.isFullscreen()) {
      this.setState({ fullscreen: true });
    } else {
      this.setState({ fullscreen: false });
    }
  }
  private needVideoControls = () => {
    return (
      this.props.video && !this.props.transparent
      // && (this.props.audio || this.props.duration > 2)
    );
  }
}
 
export default RenderVideo;

interface ProgressBarState {
  currentTime: number | string;
}

class ProgressBar extends Component<any, ProgressBarState> {
  state = {
      currentTime: 0,
  }
  private requestAnimationFrame =
    (window as any).mozRequestAnimationFrame ||
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame;
  private cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame;
  private animation: any = null;

  public componentDidMount() {
    this.requestAnimation();
  }

  componentWillUnmount() {
    window.cancelAnimationFrame = this.cancelAnimationFrame;
    window.cancelAnimationFrame(this.animation);
  }
  

  private requestAnimation = () => {
    const { body } = document;
    window.requestAnimationFrame = this.requestAnimationFrame;
    window.cancelAnimationFrame = this.cancelAnimationFrame;
    const { video, duration } = this.props;


    const { currentTime: oldTime } = this.state;
    if (!body.contains(video)) return;
    
    let { currentTime } = video;
    currentTime = ((currentTime / duration) * 100);
    currentTime = Number(currentTime.toFixed(3))
    if (currentTime > 1000) currentTime = 1000
    if (oldTime !== currentTime) this.setState({ currentTime });

    if (body.contains(video)) this.animation = window.requestAnimationFrame(this.requestAnimation);
  }
  
  public render() {
    const { currentTime } = this.state;
    const transform = `translateX(-${ 100 - currentTime}% )`;

    return (
      <span class="progress-bar_full" style={{ transform }} />
    )
  }
}
