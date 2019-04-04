import { getEmbed, setEmbed } from "../db";
import { linkEmbeds } from "../templates";
import { Dict, fetchJSON, noop } from "../util";
import { EMBED_CACHE_EXPIRY_MS, POST_EMBED_SEL } from "../vars";

interface OEmbedDoc {
    error?: string;
    title: string;
    html: string;
    width?: number;
    height?: number;
    thumbnail_url?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
}

// TODO(Kagami): Move to config.
const YT_KEY = "AIzaSyDQubcU_hhtJ4SwHIniHq5SkSSsBIK6B9c";
const SC_KEY = "goRA3rjE5gwmG34euLDHyXKNgHRGyFmq";
// const IG_KEY = "a719404e4cf8458eb4ee4675284312a0";

const embedUrls: { [key: string]: (url: string) => string } = {
    vlive: (url) => `/api/embed?url=${url}`,
    youtube: (url) => {
        const id = linkEmbeds.youtube.exec(url)[1];
        const attrs = [
            `key=${YT_KEY}`,
            `id=${id}`,
            `maxWidth=1280`,
            `maxHeight=720`,
            `part=snippet,player`,
        ];
        return `https://www.googleapis.com/youtube/v3/videos?${attrs.join("&")}`;
    },
    youtubepls: (url) => {
        const id = linkEmbeds.youtubepls.exec(url)[1];
        const attrs = [`key=${YT_KEY}`, `id=${id}`, `part=snippet,contentDetails`];
        return `https://www.googleapis.com/youtube/v3/playlists?${attrs.join("&")}`;
    },
    soundcloud: (url) => {
        const id = linkEmbeds.soundcloud.exec(url)[0];
        const attrs = [`client_id=${SC_KEY}`, `url=${id}`];
        return `https://api.soundcloud.com/resolve.json?${attrs.join("&")}`;
    },
    instagram: (url) => {
        const id = linkEmbeds.instagram.exec(url)[0].replace(/www\./i, "");
        const attrs = [`url=${id}`, `omitscript=true`];
        return `https://noembed.com/embed?${attrs.join("&")}`;
        // return `https://api.instagram.com/oembed?${attrs.join("&")}`;
    },
};
// if (window.innerWidth > window.innerWidth)
const embedResponses: { [key: string]: (res: Dict) => OEmbedDoc } = {
    vlive: (res) => res as OEmbedDoc,
    youtube: (res) => {
        const item = res.items[0];
        // TODO(Kagami): Cache fail responses.
        if (!item) throw new Error("not found");
        const id = item.id;
        const player = item.player;
        const snippet = item.snippet;
        const thumbs = snippet.thumbnails;
        const thumb = thumbs.maxres || thumbs.high;
        return {
            title: snippet.title,
            html: `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1"></iframe>`,
            // Sometimes these numbers are missed.
            width: player.embedWidth || 1280,
            height: player.embedHeight || 720,
            thumbnail_url: thumb.url,
            thumbnail_width: thumb.width,
            thumbnail_height: thumb.height,
        };
    },
    youtubepls: (res) => {
        const item = res.items[0];
        if (!item) throw new Error("not found");
        const id = item.id;
        const snippet = item.snippet;
        const count = item.contentDetails.itemCount;
        const title = `${snippet.title} (${count})`;
        const thumbs = snippet.thumbnails;
        const thumb = thumbs.maxres || thumbs.high;
        return {
            title,
            html: `<iframe src="https://www.youtube.com/embed/videoseries?list=${id}&autoplay=1"></iframe>`,
            // Since playlist contains a lot of videos, there is no single
            // resolution, so use just common HD res.
            width: 1280,
            height: 720,
            thumbnail_url: thumb.url,
            thumbnail_width: thumb.width,
            thumbnail_height: thumb.height,
        };
    },
    soundcloud: (res) => {
        // const item = res;
        if (!res) throw new Error("not found");
        if (res.kind !== "track" && res.kind !== "playlist") {
            throw new Error("Not a track nor a playlist.");
        }
        const id = res.uri;
        const kind = res.kind + "s";
        const heightI = kind === "tracks" ? 150 : 400;
        return {
            title: res.title,
            width: 400,
            height: heightI,
            // tslint:disable-next-line:max-line-length
            html: `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=${id}&auto_play=true&hide_related=false&show_comments=false&show_user=false&show_reposts=false&show_teaser=true"></iframe>`,
        };
    },
    instagram: (res) => {
        // const item = res;
        if (!res) throw new Error("not found");
        if (res.type !== "rich") {
            throw new Error("response didn't return anything useful");
        }
        const url = res.html.match(
            /https:\/\/([^\.]+\.)instagram.com\/(p|tv)\/([a-zA-Z0-9_-]+)/,
        )[0];
        const tv = /\/tv\//.test(url);
        let title = res.title;
        if (title) {
            title = `: ${title}`;
            if (title.length > 30) {
                title = title.substring(0, 30) + "...";
            }
        }
        return {
            title: `${res.author_name}${title}`,
            width: res.thumbnail_width,
            height: res.thumbnail_height + 250,
            html: `<iframe src="${url}/embed" frameborder="0" scrolling="no" allowtransparency="true"></iframe>`,
            url: `${url}/embed/captioned`,
            // /tv/ urls doesn't have `/media/?size=l` and /p/ urls sometimes doesn't have thumbnail_url;
            thumbnail_url: tv ? res.thumbnail_url : `${url}/media/?size=l`,
            thumbnail_width: res.thumbnail_width,
            thumbnail_height: res.thumbnail_height,
        };
    },
};

function fetchEmbed(url: string, provider: string): Promise<OEmbedDoc> {
    url = embedUrls[provider](url);
    return fetchJSON<Dict>(url).then(embedResponses[provider]);
}

function cachedFetch(url: string, provider: string): Promise<OEmbedDoc> {
    return getEmbed<OEmbedDoc>(url).catch(() => {
        return fetchEmbed(url, provider).then((res) => {
            setEmbed(url, res, EMBED_CACHE_EXPIRY_MS);
            return res;
        });
    });
}

const embedIcons = {
    vlive: "fa fa-hand-peace-o",
    youtube: "fa fa-youtube-play",
    youtubepls: "fa fa-bars",
    soundcloud: "fa fa-soundcloud",
    instagram: "fa fa-instagram",
};

/** Additional rendering of embedded media link. */
function renderLink(link: HTMLLinkElement): Promise<void> {
    const provider = link.dataset.provider;
    const url = link.href;
    return cachedFetch(url, provider).then(
        (res) => {
            const icon = document.createElement("i");
            icon.className = `post-embed-icon ${embedIcons[provider]}`;
            link.firstChild.replaceWith(icon, " " + res.title);
            link.dataset.html = url.match(/(instagr.am|instagram.com)/) ? url : res.html;
            link.dataset.width = res.width ? res.width.toString() : "300px";
            link.dataset.height = res.height ? res.height.toString() : "166px";
            link.dataset.thumbnail_url = res.thumbnail_url ? res.thumbnail_url : "";
            link.dataset.thumbnail_width = res.thumbnail_url
                ? res.thumbnail_width.toString()
                : "";
            link.dataset.thumbnail_height = res.thumbnail_url
                ? res.thumbnail_height.toString()
                : "";

            link.classList.add("trigger-media-popup");
        },
        (err) => {
            if (/soundcloud/.test(url)) {
                console.log(`Failed to embed soundcloud ${url}: ${err.message}`);
            } else if (/youtu/.test(url) && err.message.match(/not found/)) {
                console.log(`Youtube video ${url} ${err.message}`);
            } else if (/youtu/.test(url) && /not found/.test(err.message)) {
                console.error(`Failed to embed ${url}: ${err.message}`);
            } else if (/twit/.test(url) && /not found/.test(err.message)) {
                console.error(`Failed to embed twitter link: ${url}: ${err.message}`);
            }
        },
    );
}

/**
 * Post-render embeddable links.
 *
 * Resulting promise is guaranteed to always successfully resolve when
 * rendering is finished, even if some links failed.
 */
export function render(postEl: HTMLElement): Promise<void> {
    if (!postEl.classList.contains("post_embed")) return Promise.resolve();
    const proms = [];
    for (const link of postEl.querySelectorAll(POST_EMBED_SEL)) {
        proms.push(renderLink(link as HTMLLinkElement));
    }
    return Promise.all(proms).then(noop);
}
