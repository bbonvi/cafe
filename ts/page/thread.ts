import { ThreadData } from "../common";
import { extractPageData, extractPost, isBanned, updateThreadReactions } from "./common";
import {posts} from "../state";
import {Post} from "../posts";
import {insertPostsInRange} from "../connection/synchronization";
import {on} from "../util";
import {LOAD_MORE_SEL} from "../vars";

// Render the HTML of a thread page.
export function render() {
  if (isBanned()) return;

  const { threads: data, backlinks } = extractPageData<ThreadData>();
  const { posts } = data;
  data.posts = null;

  updateThreadReactions()

  extractPost(data, data.id, data.board, backlinks);
  for (const post of posts) {
    extractPost(post, data.id, data.board, backlinks);
  }
}

const ref = {
    loading: false,
}

on(document, "click", loadMore, {
  selector: [LOAD_MORE_SEL],
});

async function loadMore() {
    if (ref.loading) {
        return
    }

    const all = posts.all();
    const op = all[0];
    if (!op) {
        return;
    }

    if (all.length >= (op as any).postCtr) {
        clearOmit()
        return
    }

    const post = posts.getFirst()

    const { top } = post.view.getRect();

    ref.loading = true;
    const scrollHeightBefore = document.documentElement.scrollHeight;
    await (insertPostsInRange(post.id, -30) as any)
      .then((inserted: number) => {
        updateOmit(inserted)
        if (inserted === 0 || posts.all().length >= (op as any).postCtr) {
          clearOmit()
        }
      })
      .finally(() => { ref.loading = false })
    const scrollHeightAfter = document.documentElement.scrollHeight
    document.documentElement.scrollBy(0, scrollHeightAfter - scrollHeightBefore)
}

function clearOmit() {
  document.querySelector("#load-more").outerHTML = ""; 
  document.querySelector("#see-all").outerHTML = ""; 
}

function updateOmit(inserted: number) {
    const thread = document.querySelector(".thread_single");

    if (thread instanceof HTMLElement) {
        const counter = parseInt(thread.style.counterReset.substring(2));
        if (!counter) {
          return
        }

        thread.style.counterReset = `p ${counter - inserted}`
    }
}
