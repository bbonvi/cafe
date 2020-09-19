import { showAlert } from "../alerts";
import API from "../api";
import { insertPost } from "../client";
import { page, posts } from "../state";
import { handlers, message } from "./messages";
import { connEvent, connSM, send } from "./state";
import { SmileReact } from "../common";
import { updateThreadReactions } from "../page/common";


// Passed from the server to allow the client to synchronise state, before
// consuming any incoming update messages.
interface SyncData {
  recent: number[]; // Posts created within the last 15 minutes
  open: { [id: number]: OpenPost }; // Posts currently open
  deleted: number[]; // Posts deleted
  deletedImage: number[]; // Posts deleted in this thread
  banned: number[]; // Posts banned in this thread
  reacts: SmileReact[]
}

// State of an open post
interface OpenPost {
  body: string;
}

// Send a requests to the server to synchronise to the current page and
// subscribe to the appropriate event feeds
export function synchronise() {
  send(message.synchronise, {
    board: page.board,
    thread: page.thread,
  });
}

export function reactToPost(smileName: string, postId: number) {
  // send(message.reactToPost, {
  //   smile: smileName,
  //   post: postId,
  // })
}

// Fetch a post not present on the client and render it
async function fetchMissingPost(id: number) {
  insertPost(await API.post.get(id));
  posts.get(id).view.reposition();
}

// Fetch posts in specific range and insert it in thread
export async function insertPostsInRange(start: number, limit: number) {
  const postsFetched = await API.post.listRange(page.thread, start, limit)
  postsFetched.reverse()
  let inserted = 0;
  for (const post of postsFetched) {
    // avoid duplicates
    if (posts.get(post.id)) {
      continue
    }

    insertPost(post, true)
    posts.get(post.id).view.reposition();
    inserted += 1;
  }

  return inserted;
}

// Synchronise to the server and start receiving updates on the appropriate
// channel. If there are any missed messages, fetch them.
handlers[message.synchronise] = async (data: SyncData) => {
  // Skip posts before the first post in a shortened thread
  let minID = 0;
  if (page.lastN) {
    minID = Infinity;
    for (const { id } of posts) {
      if (id < minID && id !== page.thread) {
        minID = id;
      }
    }
    // No replies ;_;
    if (minID === Infinity) {
      minID = page.thread;
    }
  }

  // Board pages currently have no sync data
  if (data) {
    const { recent = [], deleted = [], reacts = [] } = data;
    const proms: Array<Promise<void>> = [];

    for (const id of recent) {
      if (id >= minID && !posts.has(id)) {
        // FIXME(Kagami): Remove deleted posts from recent.
        proms.push(fetchMissingPost(id).catch(() => { /* skip */ }));
      }
    }

    for (const id of deleted) {
      const post = posts.get(id);
      if (post && !post.deleted) {
        post.setDeleted();
      }
    }

    for (const react of reacts) {
      const post = posts.get(react.postId);
      if (post && !post.deleted) {
        post.setReaction(react);
      }
    }

    // for (const id of banned) {
    //   const post = posts.get(id);
    //   if (post && !post.banned) {
    //     post.setBanned();
    //   }
    // }

    // for (const id of deletedImage) {
    //   const post = posts.get(id);
    //   if (post && post.image) {
    //     post.removeImage();
    //   }
    // }

    await Promise.all(proms).catch((e) => {
      showAlert(e.message);
      throw e;
    })
    if (proms.length > 0) {
      updateThreadReactions()
    }
  }

  connSM.feed(connEvent.sync);
};
