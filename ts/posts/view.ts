import { View, ViewAttrs } from "../base";
import { SmileReact } from "../common";
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
import { getRecent } from "./smile-box";

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
        if (this.animate) {
            this.el.classList.add("should-anim");
        }
        this.model.view.el.innerHTML = this.getEveryoneHTML();
    }

    // Apply client-specific formatting to post rendered on server-side.
    public afterRender(): Promise<void> {
        this.renderTime();
        if (this.animate) {
            this.el.classList.add("post_loaded");
        }

        return renderEmbeds(this.el);
    }

    public renderRecent() {
        const recentContainer = this.model.view.el.querySelector(".reaction-box__recent");
        recentContainer.innerHTML = "";
        const recent = getRecent().filter((name) => name !== "heart").slice(0, 3);
        for (const smileName of recent) {
            recentContainer.innerHTML += `
            <div
                class="smiles-item trigger-react-post"
                data-smile-name="${smileName}"
                data-post-id="${this.model.id}"
            >
                <i class="smile smile-${smileName}" title=":smileName:"></i>
            </div>
            `;
        }

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

    // public incrementReaction(smileName: string) {
    //     const currentReaction =
    //         this.model.reacts
    //             .find((reaction) => smileName === reaction.smileName);

    //     if (!currentReaction) {
    //         this.renderReaction({
    //             postId: this.model.id,
    //             count: 1,
    //             smileName,
    //         })
    //     } else {
    //         this.renderReaction({
    //             ...currentReaction,
    //             count: currentReaction.count + 1
    //         })
    //     }
    // }

    public renderReaction(reaction: SmileReact) {
        // if SmileReact object doesn't have a count,
        // then we either increment or just set it to 1

        // Get or create container for reaction badge.
        const [reactContainer, created] = this.getReactContainer(reaction.smileName);

        if (created) {
            reactContainer.classList.add(
                "react-" + reaction.smileName,
                "post-react",
                "trigger-react-post",
                "post-react--minimized", // for animation
            );

            const smileEl = document.createElement("i");
            smileEl.classList.add("smile", "smile-" + reaction.smileName);
            smileEl.title = reaction.smileName;

            const counterEl = document.createElement("span");
            counterEl.classList.add("post-react__count");
            counterEl.innerText = (reaction.count || 1).toString();

            reactContainer.appendChild(smileEl);
            reactContainer.appendChild(counterEl);
            reactContainer.dataset.postId = this.model.id.toString();
            reactContainer.dataset.smileName = reaction.smileName;
        } else {
            // skip if already set or is less than old value
            const counter = reactContainer.lastElementChild as HTMLDivElement;
            const oldValue = parseInt(counter.innerText, 10);
            const newValue = reaction.count ? reaction.count : oldValue + 1;

            if (newValue > oldValue) {
                counter.innerText = newValue.toString();
                // for animation
                reactContainer.classList.add("post-react--maximized");
            }
        }

        // remove classes later, so animation could finish
        setTimeout(() => {
            reactContainer.classList.remove("post-react--maximized");
            reactContainer.classList.remove("post-react--minimized");
        }, 100);

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
            const divider = this.model.view.el.querySelector(".post-reacts__divider");

            let created = false;
            let reactContainer: HTMLDivElement = postReacts.querySelector(".react-" + smileName);
            if (!reactContainer) {
                reactContainer = postReacts.insertBefore(document.createElement("div"), divider);
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
