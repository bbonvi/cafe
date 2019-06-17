import { View } from "../base";
import _ from "../lang";
import options from "../options";
import { Post } from "../posts";
import { mine } from "../state";
import { DEFAULT_NOTIFICATION_IMAGE_URL } from "../vars";
import { repliedToMe } from "./tab";

// Notify the user that one of their posts has been replied to.
export default function notifyAboutReply(post: Post) {
  // Ignore my replies to me (lol samefag).
  if (options.doNotDisturb) return;
  if (mine.has(post.id)) return;

  // Check if already seen.
  if (post.seen()) return;

  // Update favicon status;
  repliedToMe(post);

  // Check if notifications are available.
  if (!options.notification
      || typeof Notification !== "function"
      || (Notification as any).permission !== "granted"
  ) return;

  // Finally display sticky notification.
  let image = "";
  if (!options.workModeToggle && post.files) {
    image = post.getFileByIndex(0).thumb;
  }
  const { userName } = post;
  const title = userName ? `${userName} ${_("repliedBy")}` : _("repliedBy");
  const n = new Notification(title, {
    body: post.body,
    requireInteraction: false,
    renotify: false,
    icon: DEFAULT_NOTIFICATION_IMAGE_URL,
    image,
    vibrate: true,
  } as any);
  n.onclick = () => {
    n.close();
    window.focus();
    location.hash = "#" + post.id;
  };
  setTimeout(() => {
    n.close();
  }, 5000);
}

// Textual notification at the top of the page
// TODO(Kagami): Rework.
export class OverlayNotification extends View<null> {
  constructor(text: string) {
    super({ el: null }); // importTemplate("notification").firstChild as HTMLElement });
    this.on("click", () =>
      this.remove());
    this.el.querySelector("b").textContent = text;
    // overlay.prepend(this.el)
  }
}
