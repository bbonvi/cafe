import { Component, h, render } from "preact";
import smiles from "../../smiles-pp/smiles";
import {
    HOVER_TRIGGER_TIMEOUT_SECS,
    REACTION_HOVER_CONTAINER_SEL,
} from "../vars";
import { getRecent } from "./smile-box";

interface Position {
    top?: number;
    right?: number;
    left?: number;
    bottom?: number;
}

interface ReactionBoxState {
    visible: boolean;
    postId: number;
    recent: string[];
    position: Position;
}

class ReactionBox extends Component<any, ReactionBoxState> {
    public timers: { [key: number]: NodeJS.Timer };
    constructor() {
        super();
        this.state = {
            visible: false,
            postId: null,
            recent: [],
            position: {
                top: 0,
                right: 0,
            },
        };
        this.timers = {
            1: null,
        };
    }

    public componentDidMount() {
        document.addEventListener("mousemove", this.handleMouseMove);
    }
    public componentWillUnmount() {
        document.removeEventListener("mousemove", this.handleMouseMove);
        Object.values(this.timers).forEach((timerRef) => clearTimeout(timerRef));
    }

    public handleMouseMove = (e: MouseEvent) => {
        console.log(e.target);
        const target = e.target as HTMLElement;
        if (!target) {
            return;
        }

        // console.log(target.closest(".smile-box_full"));


        if (target.closest(".smile-box_full")) {
            this.setState({ visible: false });
            return;
        }

        if (target.closest(".reaction-box")) {
            return;
        }

        const postEl = target.closest(".post") as HTMLElement;

        clearTimeout(this.timers[1]);
        if (!postEl) {
            this.hideWithTimeout();
            return;
        }

        const rect = postEl.getBoundingClientRect();

        this.setState({
            position: {
                top: rect.top - 5,
                right: rect.right - 5,
            }
        });

        const postId = parseInt(postEl.dataset.id, 10);
        if (!this.state.visible) {
            this.setState({ visible: true });
        }

        if (this.state.postId !== postId) {
            this.setState({
                postId,
                recent: this.getRecents(),
            });
        }
    }

    public hideWithTimeout = () => {
        if (!this.state.visible) {
            return;
        }

        this.timers[1] = setTimeout(() => {
            this.setState({ visible: false });
        }, HOVER_TRIGGER_TIMEOUT_SECS * 1000);
    }

    public getRecents() {
        return getRecent().filter((name) => name !== "heart").slice(0, 3);
    }

    public getTitle = (smileName: string) => ":" + smileName + ":";

    public renderRecent() {
        return this.state.recent.map((recent) => this.renderSmile(recent));
    }

    public renderSmile(smileName: string) {
        return (
            <div class="smiles-item">
                <i class={"smile smile-" + smileName} title={this.getTitle(smileName)} />
            </div>
        );
    }

    public renderHeart() {
        if (!smiles.has("heart")) {
            return null;
        }
        return this.renderSmile("heart");
    }

    public render(_: any, state: ReactionBoxState) {
        if (!state.postId) {
            return null;
        }

        const styles = {
            display: state.visible ? "" : "none",
            position: "fixed",
            ...state.position,
        };

        return (
            <div style={styles} class="smile-box reaction-box">
                <div class="reaction-box__row reaction-box__recent">
                    {this.renderRecent()}
                </div>
                <div class="reaction-box__row reaction-box__like">
                    {this.renderHeart()}
                </div>
            </div>
        );
    }
}

export function init() {
  const container = document.querySelector(REACTION_HOVER_CONTAINER_SEL);
  if (container) {
    render(<ReactionBox />, container);
  }
}
