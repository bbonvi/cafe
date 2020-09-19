import { Model } from "../base";
import { Post } from "./model";

/** Holds a collection of Post models. */
export default class PostCollection extends Model {
  private models: { [key: string]: Post } = {};

  constructor() {
    super();
  }

  /** Return weather a post exists in the collection. */
  public has(id: number): boolean {
    return id in this.models;
  }

  /** Retrieve a model by its ID. */
  public get(id: number): Post {
    return this.models[id];
  }

  /** Add model to the collection. */
  public add(model: Post) {
    model.collection = this;
    this.models[model.id] = model;
  }

  /** Remove model from the collection. */
  public remove(model: Post) {
    delete model.collection;
    delete this.models[model.id];
  }

  /** Remove all related models from the collection. */
  public removeThread(opModel: Post) {
    for (const model of this) {
      if (model.op === opModel.id) {
        this.remove(model);
      }
    }
  }

  /** Remove all models from the collection. */
  public clear() {
    for (const model of this) {
      delete model.collection;
    }
    this.models = {};
  }

  /** Return all models. */
  public all(): Post[] {
    return Object.keys(this.models)
      .map((id) => this.models[id]);
  }

  /** Return first post in thread that is not OP */
  public getFirst(): Post {
      const all = this.all();
      return all[1]
  }

  /** Return last post in thread that is not OP */
  public getLast(): Post {
      const all = this.all();
      return all.slice(1)[all.length - 2]
  }

  /** Make collection iterable. */
  public *[Symbol.iterator](): IterableIterator<Post> {
    yield* this.all();
  }
}
