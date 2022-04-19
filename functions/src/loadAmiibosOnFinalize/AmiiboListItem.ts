export interface AmiiboLineupData {
  componentPath: string;
  amiiboList: Array<AmiiboListItem>;
  items: Array<any>;
}

export interface AmiiboListItem {
  detailsPath: string;
  detailsUrl: string;
  unixTimestamp: number;
  slug: string;
  amiiboName: string;
  overviewDescription: string;
  figureURL: string;
  presentedBy: string;
  releaseDateMask: string;
  series: string;
  boxArtUrl: string;
  gameCode: string;
  amiiboPAge: string;
  franchise: string;
  type: string; //Figure, Plush, Card
  upc: string;
  price: string;
  hexCode: string;
  isReleased: boolean;
}