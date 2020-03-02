import { View, ViewAttrs } from "../base";
import { SmileReact } from "../common";
import _ from "../lang";
import options from "../options";
import { page, getSmileByItsName } from "../state";
import {
    makePostContext, readableTime,
    relativeTime, renderPostLink, TemplateContext,
} from "../templates";
import { getID, createElement } from "../util";
import { POST_BACKLINKS_SEL, THREAD_SEL } from "../vars";
import { render as renderEmbeds } from "./embed";
import { Post, Thread } from "./model";
import { getRecent } from "./smile-box";
import { smilePath } from "./images";

/**
 * Base post view class
 */
export default class PostView extends View<Post> {
    timers: any;
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
        this.timers = {};
        this.model.view.el.innerHTML = this.getEveryoneHTML();
    }

    // Apply client-specific formatting to post rendered on server-side.
    public afterRender(): Promise<void> {
        this.renderTime();
        if (this.animate) {
            this.el.classList.add("post_loaded");
        }

        requestAnimationFrame(() => this.renderRecent())
        return renderEmbeds(this.el);
    }

    public renderRecent() {
        // TODO: Fix rerender
        const recentContainer = this.model.view.el.querySelector(".reaction-box__recent");
        recentContainer.innerHTML = "";
        const recent = getRecent().filter((name) => name !== "heart").slice(0, 3);
        const recentList = recent
            .map((s) => getSmileByItsName(s))
            .filter((s) => !!s);
        for (const smile of recentList) {
            recentContainer.innerHTML += `
            <div
                class="smiles-item trigger-react-post"
                data-smile-name="${smile.name}"
                data-post-id="${this.model.id}"
            >
                <img
                    class="smile"
                    src="${smilePath(smile.fileType, smile.sha1)}"
                    title=":${smile.name}:"
                >
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

    public renderReactContainerElements(reactContainer: HTMLElement, reaction: SmileReact) {
        const containerClasses = [
            "react-" + reaction.smile.name,
            "post-react",
            "trigger-react-post",
            "post-react--minimized", // for animation
        ];

        const smile = getSmileByItsName(reaction.smile.name);
        if (!smile) {
            throw Error();
        }

        const smileEl = createElement("img", {
            classes: ["smile"],
            src: smilePath(smile.fileType, smile.sha1),
            title: smile.name,
        });
        const counterEl = createElement("span", {
            classes: "post-react__count",
            text: 0,
        });

        reactContainer.appendChild(smileEl);
        reactContainer.appendChild(counterEl);
        reactContainer.classList.add(...containerClasses);
        reactContainer.dataset.postId = String(this.model.id);
        reactContainer.dataset.smileName = reaction.smile.name;

        return reactContainer;
    }

    public delayedRemoveReaction(reactContainer: HTMLElement, smileName: string) {
        reactContainer.classList.add("post-react--beforedelete");
        this.timers[smileName] = setTimeout(() => {
            reactContainer.outerHTML = "";
        }, 100);
    }

    public setReaction(reaction: SmileReact) {
        const [reactContainer, created] = this.getReactContainer(reaction.smile.name);
        if (reaction.count === 0 && created) {
            reactContainer.outerHTML = "";
            return;
        }
        clearTimeout(this.timers[reaction.smile.name]);

        // dont' rerender if already exists
        if (created) {
            try {
                this.renderReactContainerElements(reactContainer, reaction);
            } catch (error) {
                return;
            }
        }
        if (reaction.self) {
            reactContainer.classList.add("post-react--self");
        } else if (reaction.self === false) {
            reactContainer.classList.remove("post-react--self");
        }

        const counter = reactContainer.querySelector(".post-react__count") as HTMLDivElement;
        const oldValue = parseInt(counter.innerText, 10);

        if (reaction.count === 0) {
            this.delayedRemoveReaction(reactContainer, reaction.smile.name);
            return;
        } else {
            counter.innerText = reaction.count.toString();
        }

        if (reaction.count !== oldValue) {
            reactContainer.classList.add("post-react--counterchange");
        }
        setTimeout(() => {
            reactContainer.classList.remove("post-react--beforedelete");
            reactContainer.classList.remove("post-react--minimized");
        }, 200);
        setTimeout(() => {
            reactContainer.classList.remove("post-react--counterchange");
        }, 100);
        this.handleExtraReactions();
    }

    public handleExtraReactions() {
        const reactionsNumber = this.model.view.el.querySelectorAll(".post-react").length;
        const hidden = this.model.view.el
            .querySelector(".post-reacts")
            .classList
            .contains("post-reacts--hidden");

        if (reactionsNumber > 10 && hidden) {
            const showMore = this.model.view.el.querySelector(".post-reacts__showmore") as HTMLElement;
            showMore.style.display = "";
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
