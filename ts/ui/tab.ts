/**
 * Tab title and favicon rendering.
 */

import { connSM, connState } from "../connection";
import { Post } from "../posts";
import { posts } from "../state";

// Hardcoded because needs to be available without connectivity.
// tslint:disable-next-line:max-line-length
const discoFavicon = "data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAA9PT3/Pz8//z8/P/8/Pz//Pz8//z8/P/8/Pz//Pz8//z8/P/8/Pz//Pz8//z8/P/8/Pz//Pz8//z09Peo+Pj4+Pj4+/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/PT096j4+Pv9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/z8/P/9RUVH/Xl5e/15eXv9eXl7/Xl5e/15eXv9eXl7/Xl5e/15eXv9eXl7/Xl5e/15eXv9eXl7/Xl5e/15eXv9RUVH/UVFR/15eXv9eXl7/Xl5e/15eXv9eXl7/Xl5e/15eXv9eXl7/Xl5e/15eXv9eXl7/Xl5e/15eXv9eXl7/UVFR/z4+Pv9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/z8/P/8+Pj7/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP8/Pz//Pj4+/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/Pz8//zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8wMDBAMjIy3zMzM/8zMzP/Oj5F/zMzM/8zMzP/Njg8/zY4PP8zMzP/Oj5F/zMzM/8zMzP/Oj5F/zMzM/8yMjLfAAAAAAAAAAAyMjJgMjIy70pVaf82ODz/Oj5F/05bcv85PUX/MzMz/0pVaf82ODz/MzMz/0pVaf82ODz/MjIygAAAAAAAAAAAAAAAADAwMBAyMjJ/MjIy71JhfP82ODz/PkRO/0dQYf8zMzP/MTt7/zFFw/8xO3v/MzMzzzAwMBAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMCAyMjKfMzMz/zMzM/9KVWn/Njg8/zFFw/8xSNj/MUXH9zAwMBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAzMzO/QkpY/zIyMt8wRcnzMUjY/zBI2N8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMEfYcGqIxvxJY8+QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABxjsYtco/FwXKPxf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAADgAAAA+AEAAP4DAAD/4wAA//EAAA==";

const faviconEl = document.getElementById("favicon");
const urlBase = "/static/favicons/";
const baseTitle = document.title;
let queue = [] as [Post];

// All possible favicon states.
const enum states { default, disconnected, error, unread, replied }

// Last state rendered as a favicon. Used to reduce DOM & tab header
// writes.
const lastRendered = {
  state: states.default,
  unseenPosts: 0,
};

let unseenPosts = 0;
let unseenReplies = false;
let recalcPending = false;

function processQueue() {
  for (const post of queue) {
    if (!post.seen()) {
      unseenPosts += 1;
    }
  }
  queue = [] as any;
  resolve();
}

// Recalculate unseen post status.
function recalc() {
  unseenPosts = 0;
  unseenReplies = false;
  recalcPending = false;
  for (const post of posts) {
    if (post.seen()) continue;
    unseenPosts += 1;
    if (post.isReply()) {
      unseenReplies = true;
    }
  }
  resolve();
}

// Resolve tab title and favicon.
function resolve() {
  let prefix = "";
  let state = states.default;
  if (connSM.state === connState.desynced) {
    prefix = "--- ";
    state = states.error;
  } else if (connSM.state === connState.dropped) {
    prefix = "--- ";
    state = states.disconnected;
  } else {
    if (unseenPosts) {
      prefix = `(${unseenPosts}) `;
      state = states.unread;
    }
    if (unseenReplies) {
      prefix = ">> " + prefix;
      state = states.replied;
    }
  }
  apply(prefix, state);
}

// Write tab title and favicon to DOM.
function apply(prefix: string, state: states) {
  // Same data - skip write to DOM.
  if (lastRendered.state === state
      && lastRendered.unseenPosts === unseenPosts) {
    return;
  }
  lastRendered.unseenPosts = unseenPosts;
  lastRendered.state = state;

  document.title = prefix + baseTitle;
  let url = urlBase;
  switch (state) {
  case states.default:
    url += "default.ico";
    break;
  case states.unread:
    url += "unread.ico";
    break;
  case states.replied:
    url += "reply.ico";
    break;
  case states.error:
    url += "error.ico";
    break;
  case states.disconnected:
    url = discoFavicon;
    break;
  }
  faviconEl.setAttribute("href", url);
}

// Account for immediate reconnection and only render favicon, if not
// reconnected in few seconds.
function delayedDiscoRender() {
  setTimeout(() => {
    if (connSM.state === connState.dropped
        || connSM.state === connState.desynced) {
      resolve();
    }
  }, 5000);
}

function onScroll() {
  if (recalcPending || document.hidden) return;
  recalcPending = true;
  setTimeout(recalc, 200);
}

// Update unseen post count based on post visibility and scroll
// position.
export function postAdded(post: Post) {
  // Async batch processing since visibility calculations force a
  // layout.
  if (!queue.length) {
    // Can't use RAF since it's disabled in background tabs.
    setTimeout(processQueue, 16);
  }
  queue.push(post);
}

// Add unseen reply indicator to tab header.
export function repliedToMe(post: Post) {
  if (!post.seen()) {
    unseenReplies = true;
    resolve();
  }
}

export function init() {
  connSM.on(connState.synced, resolve);
  connSM.on(connState.dropped, delayedDiscoRender);
  connSM.on(connState.desynced, delayedDiscoRender);

  document.addEventListener("scroll", onScroll, {passive: true});
  document.addEventListener("visibilitychange", onScroll);
}
