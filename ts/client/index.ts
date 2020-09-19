/**
 * Core websocket message handlers.
 */

import { showAlert } from "../alerts";
import { PostData, SmileReact } from "../common";
import { connEvent, connSM, handlers, message } from "../connection";
import { isHoverActive, Post, PostView, observePost } from "../posts";
import { page, posts } from "../state";
import { postAdded } from "../ui";
import { isAtBottom, scrollToBottom } from "../util";
import { isFirefox, isLinux, isWebkit } from "../vars";

// Run a function on a model, if it exists
function handle(id: number, fn: (m: Post) => void) {
  const model = posts.get(id);
  if (model) {
    fn(model);
  }
}

// let tabInFocus = true;

// window.addEventListener('visibilitychange', () => tabInFocus = !tabInFocus)
// window.addEventListener('focus', () => tabInFocus = true)

var vis = () => {
  var stateKey: any, keys = {
      hidden: "visibilitychange",
      webkitHidden: "webkitvisibilitychange",
      mozHidden: "mozvisibilitychange",
      msHidden: "msvisibilitychange"
  };
  for (stateKey in keys) {
      if (stateKey in document) {
          break;
      }
  }
  return !document[stateKey]
};

// Insert a post into the models and DOM
export function insertPost(data: PostData, silent = false) {
  // don't insert post that is already exists
  const postWithSameClienIdExists =
      data.clientID && posts.all().find(p => p.clientID === data.clientID);
  const postsWithSameIdExists = data.id < Infinity && posts.has(data.id);
  if (postsWithSameIdExists || postWithSameClienIdExists) {
      return
  }

  const atBottom = isAtBottom();

  const model = new Post(data);
  model.op = page.thread;
  model.board = page.board;
  posts.add(model);
  const view = new PostView(model, null);
  view.afterRender();

  model.propagateLinks();

  const last = document.getElementById("thread-container").firstChild.lastElementChild;
  last.after(view.el);
  if (!silent) {
    postAdded(model);
  }
  smileLineOffset(view.el.querySelectorAll(".post-message p"));
  const tabInFocus = vis();
  // options.scrollToBottom &&
  if (tabInFocus && atBottom && !isHoverActive() && !silent) {
    scrollToBottom();
  }
  const { reacts = [] } = data;
  (reacts || []).forEach((react: SmileReact) => {
    view.setReaction(react);
  });

  return view

  // observePost(view.el)
}

// TODO: This has to be on server-side!!!
function smileLineOffsetJob() {
  const elems = document.querySelectorAll(".post-message p");
  smileLineOffset(elems, true);
}
smileLineOffsetJob();

// letter-spacing for strong hinting fix (possible)
if (isLinux) {
  document.documentElement.classList.add("is-linux");
}
if (isFirefox) {
  document.documentElement.classList.add("is-firefox");
}

if (isWebkit) {
  document.documentElement.classList.add("is-webkit");
}

export function smileLineOffset(elems: any, isAsync = false) {
  for (const elem of elems) {
    function exec() {
      if (!elem.innerText || !/\S/.test(elem.innerText)) {
        elem.classList.add("smiles-offset");
      }
    }
    if (isAsync) {
      setTimeout(exec, 0)
    } else {
      exec()
    }
  }
}

export function init() {
  handlers[message.invalid] = (msg: string) => {
    showAlert(msg);
    connSM.feed(connEvent.error);
    throw new Error(msg);
  };

  handlers[message.insertPost] = insertPost;

  handlers[message.deletePost] = (id: number) => handle(id, (m) => m.setDeleted());

  handlers[message.redirect] = (board: string) => {
    location.href = `/${board}/`;
  };

  // handlers[message.notification] = (text: string) =>
  //   new OverlayNotification(text);

  // handlers[message.insertImage] = (msg: ImageMessage) =>
  //   handle(msg.id, (m) => {
  //     delete msg.id;
  //     m.insertImage(msg);
  //   });

  // handlers[message.append] = ([id, char]: [number, number]) =>
  //   handle(id, (m) =>
  //     m.append(char));

  // handlers[message.backspace] = (id: number) =>
  //   handle(id, (m) =>
  //     m.backspace());

  // handlers[message.splice] = (msg: SpliceResponse) =>
  //   handle(msg.id, (m) =>
  //     m.splice(msg));

  // handlers[message.closePost] = ({ id, links }: CloseMessage) =>
  //   handle(id, (m) => {
  //     if (links) {
  //       m.links = links;
  //       m.propagateLinks();
  //     }
  //     m.closePost();
  //   });

  // handlers[message.deleteImage] = (id: number) =>
  //   handle(id, (m) =>
  //     m.removeImage());

  // handlers[message.banned] = (id: number) =>
  //   handle(id, (m) =>
  //     m.setBanned());
}
