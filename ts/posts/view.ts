import { View, ViewAttrs } from "../base";
import _ from "../lang";
import options from "../options";
import { page } from "../state";
import {
  makePostContext, readableTime,
  relativeTime, renderPostLink, TemplateContext,
} from "../templates";
import { getID } from "../util";
import { POST_BACKLINKS_SEL, THREAD_SEL } from "../vars";
import { render as renderEmbeds } from "./embed";
import { Post, Thread } from "./model";
import { SmileReact } from "../common";

/**
 * Base post view class
 */
export default class PostView extends View<Post> {
  constructor(model: Post, el: HTMLElement | null) {
    const attrs: ViewAttrs = { model };

    const thread = new Thread(model);
    const index = thread.id !== page.thread;
    const all = page.board === "all";
    attrs.el = el || makePostContext(thread, model, null, index, all).renderNode();

    super(attrs);

    this.model.view = this;
    this.model.seenOnce = !!el;
    this.animate = !el;
    if (this.animate) this.el.classList.add("should-anim")
    this.model.view.el.innerHTML = this.getEveryoneHTML();
  }

  // Apply client-specific formatting to post rendered on server-side.
  public afterRender(): Promise<void> {
    this.renderTime();
    if (this.animate) {
      this.el.classList.add("post_loaded");
    }
    this.renderReactions()

    return renderEmbeds(this.el);
  }

  // Renders a time element. Can be either absolute or relative.
  public renderTime() {
    let text = readableTime(this.model.time);
    const el = this.el.querySelector("time");
    if (options.relativeTime) {
      el.setAttribute("title", text);
      text = relativeTime(this.model.time);
    }
    el.textContent = text;
  }

  // Render links to posts linking to this post.
  public renderBacklinks() {
    const index = !page.thread;
    const rendered = Object.keys(this.model.backlinks).map((id) => {
      const op = this.model.backlinks[id];
      const cross = op !== this.model.op;
      return renderPostLink(+id, cross, index);
    });
    if (!rendered.length) return;

    const html = new TemplateContext("post-backlinks", {
      Backlinks: rendered,
      LReplies: _("replies"),
    }).render();

    const container = this.el.querySelector(POST_BACKLINKS_SEL);
    container.innerHTML = html;
  }

  public renderReactions() {
    if (!this.model.reacts) {
      return;
    }

    this.model.reacts.forEach((reaction) => {
      this.renderReaction(reaction);
    })
  }

  public renderReaction(reaction: SmileReact) {
    const [reactContainer, created] = this.getReactContainer(reaction.smileName);

    if (created) {
      reactContainer.classList.add("react-" + reaction.smileName, "post-react", "trigger-react-post");

      const smileEl = document.createElement("i");
      smileEl.classList.add("smile", "smile-" + reaction.smileName);
      smileEl.title = reaction.smileName;

      const counterEl = document.createElement("span");
      counterEl.classList.add("post-react__count");
      counterEl.innerText = reaction.count.toString();

      reactContainer.appendChild(smileEl);
      reactContainer.appendChild(counterEl);
      reactContainer.dataset.postId = this.model.id.toString();
      reactContainer.dataset.smileName = reaction.smileName;
    } else {
      (reactContainer.lastElementChild as HTMLDivElement).innerText = reaction.count.toString();
    }
  }

  public removeThread() {
    this.el.closest(THREAD_SEL).remove();
  }

  // Render the sticky status of a thread OP.
  // TODO(Kagami): Implement.
  public renderSticky() {
    // const old = this.el.querySelector(".sticky")
    // if (old) {
    //   old.remove()
    // }
    // if (this.model.sticky) {
    //   this.el
    //     .querySelector(".mod-checkbox")
    //     .after(importTemplate("sticky"))
    // }
  }

  // Inserts PostView back into the thread ordered by id.
  public reposition() {
    // Insert before first post with greater ID.
    const { id, op } = this.model;
    const thread = document.getElementById(`thread${op}`);
    if (!thread) return;
    for (const el of Array.from(thread.children)) {
      switch (el.tagName) {
        case "ARTICLE":
          if (getID(el) > id) {
            el.before(this.el);
            return;
          }
          break;
        case "ASIDE": // On board pages
          el.before(this.el);
          return;
      }
    }
    // This post should be last or no posts in thread.
    thread.append(this.el);
  }

  // Check if we can see the post or have scrolled past it.
  public scrolledPast() {
    const rect = this.el.getBoundingClientRect();
    const viewW = document.body.clientWidth;
    const viewH = document.body.clientHeight;
    return rect.bottom < viewH && rect.left > 0 && rect.left < viewW;
  }

  public getReactContainer(smileName: string): [HTMLDivElement, boolean] {
    const postReacts = this.model.view.el.querySelector(".post-reacts");
    const addReactionButton = this.model.view.el.querySelector(".post-react--add");

    let created = false;
    let reactContainer: HTMLDivElement = postReacts.querySelector(".react-" + smileName);
    if (!reactContainer) {
      reactContainer = postReacts.insertBefore(document.createElement("div"), addReactionButton);
      created = true;
    }

    return [reactContainer, created];
  }

  private getEveryoneHTML() {
    let { innerHTML } = this.model.view.el;
    const everyoneHTML = `<a class="everyone">@everyone</a>`;
    const everyone = new RegExp('@everyone', 'g')
    innerHTML = innerHTML.replace(everyone, everyoneHTML);
    return innerHTML;
  }

}
