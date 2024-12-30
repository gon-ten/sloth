export class CollectionNotFoundError extends Error {
  constructor(private collectionName: string) {
    super(`Collection with name "${collectionName}" not found`);
  }
}
