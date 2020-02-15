import { PostData, ThreadData } from "../common";
import _ from "../lang";
import { Backlinks, Post, PostView } from "../posts";
import { mine, page, posts } from "../state";
import { notifyAboutReply, postAdded } from "../ui";
import { extractJSON } from "../util";
import { POST_BACKLINKS_SEL } from "../vars";
import { API } from "../api";

// Check if the rendered page is a ban page.
export function isBanned(): boolean {
  return !!document.querySelector(".ban");
}

// Extract pregenerated rendered post data from DOM.
export function extractPageData<T>(): {threads: T, backlinks: Backlinks} {
  return {
    threads: extractJSON("post-data"),
    backlinks: extractJSON("backlink-data"),
  };
}
export function updateThreadReactions() {
  const { threads } = extractPageData<ThreadData>();
    API.thread.reactions(threads.id)
      .then((reacts) => {
        for (const react of reacts) {
          const post = posts.get(react.postId);
          if (post && !post.deleted) {
            post.setReaction(react);
          }
        }
      });
}
// Extract post model and view from the HTML fragment and apply
// client-specific formatting. Returns whether the element was removed.
export function extractPost(data: PostData, op: number, board: string, backlinks: Backlinks): boolean {
  const el = document.getElementById(`post${data.id}`);
  // if (hidden.has(post.id)) {
  //   el.remove();
  //   return true;
  // }
  data.op = op;
  data.board = board;

  const post = new Post(data);
  posts.add(post);

  if (page.catalog) {
    post.seenOnce = true;
  } else {
    const view = new PostView(post, el);
    view.afterRender();
    post.backlinks = backlinks[post.id];
    setTimeout(() => personalizeLinks(post), 0)
    setTimeout(() => personalizeBacklinks(post), 0)
    postAdded(post);
  }

  return false;
}

function addYous(id: number, el: HTMLElement) {
  for (const a of el.querySelectorAll(`a[data-id="${id}"]`)) {
    a.textContent += " " + _("you");
  }
}

export function addHasReplyClass(el: HTMLElement) {
  el.classList.add('has-reply');
}

// Add (You) to posts linking to the user's posts. Appends to array of posts,
// that might need to register a new reply to one of the user's posts.
function personalizeLinks(post: Post) {
  const postEl = post.view.el;

  const isEveryone = (/@everyone/).test(postEl.innerText);
  if (isEveryone) addHasReplyClass(postEl);
  if (!post.links) {
    return;
  }
  let el: HTMLElement;
  let isReply = false;
  for (const id of new Set(post.links.map((l) => l[0]))) {
    if (!mine.has(id)) {
      continue;
    }
    addHasReplyClass(postEl);
    isReply = true;

    // Don't query DOM, until we know we need it
    if (!el) {
      el = postEl.querySelector("blockquote");
    }
    addYous(id, el);
  }
  if (isReply) {
    notifyAboutReply(post);
  }
}

// Add (You) to backlinks user's posts
function personalizeBacklinks(post: Post) {
  if (!post.backlinks) {
    return;
  }
  let el: HTMLElement;
  for (const idStr of Object.keys(post.backlinks)) {
    const id = parseInt(idStr, 10);
    if (!mine.has(id)) {
      continue;
    }
    // Don't query DOM, until we know we need it
    if (!el) {
      el = post.view.el.querySelector(POST_BACKLINKS_SEL);
    }
    addYous(id, el);
  }
}
