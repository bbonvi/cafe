import { ThreadData } from "../common";
import { posts as postCollection } from "../state";
import { extractPageData, extractPost, isBanned } from "./common";
import API from "../api";

// Render the HTML of a thread page.
export function render() {
  if (isBanned()) return;

  const { threads: data, backlinks } = extractPageData<ThreadData>();
  const { posts } = data;
  data.posts = null;

  setTimeout(() => {
    API.thread.selfReacts(data.id)
      .then((reacts) => {
        for (const react of reacts) {
          const post = postCollection.get(react.postId);
          if (post && !post.deleted) {
            post.setReaction(react);
          }
        }
      });
  }, 0);

  extractPost(data, data.id, data.board, backlinks);
  for (const post of posts) {
    extractPost(post, data.id, data.board, backlinks);
  }
}
