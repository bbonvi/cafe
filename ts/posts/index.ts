import { isMobile, TRIGGER_REACT_SEL, TRIGGER_REACT_ADD_SEL } from './../vars/index';
export { Thread, Post, Backlinks } from "./model";
export { default as PostView } from "./view";
export { getFilePrefix, thumbPath, sourcePath } from "./images";
export { default as PostCollection } from "./collection";
export { isOpen as isHoverActive } from "./hover";

import options from "../options";
import { page, posts } from "../state";
import { copyToClipboard, on } from "../util";
import { RELATIVE_TIME_PERIOD_SECS} from "../vars";
import { POST_FILE_TITLE_SEL } from "../vars";
import { init as initHover } from "./hover";
import API from "../api";
import { init as initPopup, handleNewReaction } from "./popup";
import { init as initReply } from "./reply";



/** Rerender all post timestamps. */
function renderTime() {
  for (const { view } of posts) {
    view.renderTime();
  }
}

function initRenderTime() {
  options.onChange("relativeTime", renderTime);
  setInterval(() => {
    if (options.relativeTime) {
      renderTime();
    }
  }, RELATIVE_TIME_PERIOD_SECS * 1000);
}

function initFileTitle() {
  on(document, "click", (e) => {
    e.preventDefault();
    const title = (e.target as HTMLElement).getAttribute("to-copy");
    copyToClipboard(title);
  }, {selector: POST_FILE_TITLE_SEL});
}

document.addEventListener("click", (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target) {
    return;
  }
  const newReaction = target.closest(TRIGGER_REACT_ADD_SEL)  as HTMLElement;
  if (newReaction) {
    return handleNewReaction(newReaction.dataset.postId, newReaction);
  }

  const element = target.closest(TRIGGER_REACT_SEL) as HTMLElement;
  if (!element) {
    return;
  }

  const reaction = {
    smile: element.dataset.smileName,
    post: element.dataset.postId,
  };

  if (!reaction.smile) {
    return;
  }

  // Disable button for a second
  disabledButton();
  setTimeout(enableButton, 500);

  preemptivelyIncreaseCounter();
  API.post.react(reaction).catch(decreaseCounterOnError);

  function disabledButton() {
    element.classList.add("post-react--disabled");
  }
  function enableButton() {
    element.classList.remove("post-react--disabled");
  }

  function getCounter() {
    return element.lastElementChild as HTMLElement;
  }

  function preemptivelyIncreaseCounter() {
    const counter = getCounter();
    counter.innerText = (parseInt(counter.innerText, 10) + 1).toString();
  }
  function decreaseCounterOnError() {
    const counter = getCounter();
    const n = Math.max(parseInt(counter.innerText, 10) - 1, 1);
    counter.innerText = n.toString();
  }
});

interface Posts {
  top?: number;
  id?: string;
}

let coordinates: Array<Posts> = [];
let { innerHeight } = window;
function initCalc_() {
  innerHeight = window.innerHeight;
  const elements = document.getElementsByClassName('post_file');
  coordinates = [];
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (!element) continue;
    // const { top } = element.getBoundingClientRect();
    const { offsetTop: top, id} = (element as HTMLElement);
    coordinates.push({ top, id });
  }
  recalcPosts();
}
export const initCalc = () => requestAnimationFrame(initCalc_);
initCalc();

// let recalcPending = false;
export function recalcPosts(callback?: () => void) {
  const scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
  const height = innerHeight * 2;
  const top = scrollTop - height;
  const bottom = scrollTop + height;

  coordinates.forEach((postElement) => {
    const { id } = postElement;
    const post = document.getElementById(id);
    const isVisible = top < postElement.top && bottom > postElement.top;
    if (isVisible) {
      try {
        if (!post) return;
        post.classList.add("visible");
        if (!post.dataset.loaded) replaceSrcs(post);
      } catch (error) { console.log(error); }
    } else {
      if (post) post.classList.remove("visible");
    }
  });
  if (callback) callback();
}

export function replaceSrcs(post: HTMLElement) {
  post.dataset.loaded = "true";
  const containers = post.getElementsByClassName("post-file-thumb_containter");

  [...containers].forEach((container) => {
    const thumb = container.firstElementChild as HTMLImageElement;
    const blur = thumb.nextElementSibling as HTMLImageElement;
    thumb.src = thumb.dataset.src;
    thumb.srcset = thumb.dataset.srcset;
    if (thumb) {
      blur.style.backgroundImage = `url("${blur.dataset.src}")`;
    }
  });
}

let recalcPending: boolean;
function onScroll() {
  if (recalcPending) return;
  const time = isMobile ? 700 : 400;
  recalcPending = true;
  throttle(() => {
    recalcPosts(() => {
      recalcPending = false;
    });
  }, time);
  // throttle(() => {
    // recalcPosts();
    // recalcPending = false
  // }, 3, 1000)
  // setTimeout(() => {
  //   recalcPosts();
  //   recalcPending = false
  // }, time);
}

// let t1 = new Date().getTime();
let timer: number;
function throttle(callback: () => void, time: number) {
  // const currentTime = new Date().getTime();
  // const passed = currentTime - t1;
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(() => callback(), time);

  // if (passed > time) {
  //   callback()
  //   t1 = currentTime;
  // } else {

    // window.web/kitRequestAnimationFrame(() => throttle(callback, time))
  // }
}

// function throttle(callback: () => void, limit: number, time: number) {
//   /// monitor the count
//   var calledCount = 0;

//   /// refesh the `calledCount` varialbe after the `time` has been passed
//   setInterval(function(){ calledCount = 0 }, time);

//   /// creating a clousre that will be called
//   return function(){
//       /// checking the limit (if limit is exceeded then do not call the passed function
//       if (limit > calledCount) {
//           /// increase the count
//           calledCount++;
//           callback(); /// call the function
//       }
//       else console.log('not calling because the limit has exeeded');
//   };
// }

document.addEventListener("scroll", onScroll, {passive: true});
window.addEventListener("resize", initCalc, {passive: true});

export function init() {
  if (!page.catalog) {
    initRenderTime();
  }
  initFileTitle();
  initReply();
  initHover();
  initPopup();
}
