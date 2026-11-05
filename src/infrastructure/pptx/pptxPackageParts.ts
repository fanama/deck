import type { Deck } from "../../domain/deck/slideTypes.ts";
import type { Palette } from "./pptxUnits.ts";
import { SLIDE_HEIGHT_PX, SLIDE_WIDTH_PX } from "./pptxUnits.ts";

/**
 * The package parts that are the same for every deck: content types, package
 * relationships, document properties, the presentation part, one slide master
 * and one blank layout, and the theme. Only the theme's accent colour and the
 * slide list change, so they are the only parameters.
 *
 * Element order matters in OOXML — PowerPoint repairs a package whose parts are
 * out of schema order — which is why the strings below are not reordered.
 */

const XML_HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export const SLIDE_WIDTH_EMU = SLIDE_WIDTH_PX * 9525;
export const SLIDE_HEIGHT_EMU = SLIDE_HEIGHT_PX * 9525;

/** rId1 is the master, rId2 the theme; slides start at rId3. */
export function slideRelationshipId(slideIndex: number): string {
  return `rId${slideIndex + 3}`;
}

function relationship(id: string, type: string, target: string): string {
  return `<Relationship Id="${id}" Type="${REL_TYPE}/${type}" Target="${target}"/>`;
}

function relationships(entries: string): string {
  return `${XML_HEADER}<Relationships xmlns="${NS_REL}">${entries}</Relationships>`;
}

export function contentTypesXml(slideCount: number, hasImages = false): string {
  const slideOverrides = Array.from(
    { length: slideCount },
    (_, index) =>
      `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join("");

  return (
    `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    (hasImages ? `<Default Extension="png" ContentType="image/png"/>` : "") +
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
    `${slideOverrides}` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`
  );
}

export function packageRelationshipsXml(): string {
  return relationships(
    relationship("rId1", "officeDocument", "ppt/presentation.xml") +
      relationship("rId2", "metadata/core-properties", "docProps/core.xml") +
      relationship("rId3", "extended-properties", "docProps/app.xml"),
  );
}

export function corePropertiesXml(deck: Deck): string {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const title = escapeXmlText(deck.title);

  return (
    `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${title}</dc:title><dc:creator>Deck Studio</dc:creator><cp:lastModifiedBy>Deck Studio</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>` +
    `<cp:revision>1</cp:revision></cp:coreProperties>`
  );
}

export function appPropertiesXml(slideCount: number): string {
  return (
    `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>Deck Studio</Application><PresentationFormat>Widescreen</PresentationFormat>` +
    `<Slides>${slideCount}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips>` +
    `<ScaleCrop>false</ScaleCrop><Company></Company><LinksUpToDate>false</LinksUpToDate>` +
    `<SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion>` +
    `</Properties>`
  );
}

export function presentationXml(slideCount: number): string {
  const slideIds = Array.from(
    { length: slideCount },
    (_, index) => `<p:sldId id="${256 + index}" r:id="${slideRelationshipId(index)}"/>`,
  ).join("");

  return (
    `${XML_HEADER}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    `<p:sldIdLst>${slideIds}</p:sldIdLst>` +
    `<p:sldSz cx="${SLIDE_WIDTH_EMU}" cy="${SLIDE_HEIGHT_EMU}" type="screen16x9"/>` +
    `<p:notesSz cx="6858000" cy="9144000"/>` +
    `</p:presentation>`
  );
}

export function presentationRelationshipsXml(slideCount: number): string {
  const slideEntries = Array.from(
    { length: slideCount },
    (_, index) => relationship(slideRelationshipId(index), "slide", `slides/slide${index + 1}.xml`),
  ).join("");

  return relationships(
    relationship("rId1", "slideMaster", "slideMasters/slideMaster1.xml") +
      relationship("rId2", "theme", "theme/theme1.xml") +
      slideEntries,
  );
}

const EMPTY_SHAPE_TREE =
  `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>` +
  `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>`;

export function slideMasterXml(): string {
  return (
    `${XML_HEADER}<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    `<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` +
    `${EMPTY_SHAPE_TREE}</p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" ` +
    `accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
    `<p:txStyles>` +
    `<p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle>` +
    `<p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle>` +
    `<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle>` +
    `</p:txStyles></p:sldMaster>`
  );
}

export function slideMasterRelationshipsXml(): string {
  return relationships(
    relationship("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml") +
      relationship("rId2", "theme", "../theme/theme1.xml"),
  );
}

export function slideLayoutXml(): string {
  return (
    `${XML_HEADER}<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="blank" preserve="1">` +
    `<p:cSld name="Blank">${EMPTY_SHAPE_TREE}</p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
  );
}

export function slideLayoutRelationshipsXml(): string {
  return relationships(relationship("rId1", "slideMaster", "../slideMasters/slideMaster1.xml"));
}

/** `imageTarget` is the media part this slide shows, if its layout has one. */
export function slideRelationshipsXml(imageTarget?: string): string {
  return relationships(
    relationship("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml") +
      (imageTarget ? relationship("rId2", "image", imageTarget) : ""),
  );
}

const THEME_FILLS = `<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
  `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
  `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>`;

const THEME_LINES =
  `<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>` +
  `<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>` +
  `<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>`;

const THEME_EFFECTS =
  `<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle>` +
  `<a:effectStyle><a:effectLst/></a:effectStyle>` +
  `<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>`;

const THEME_BACKGROUNDS =
  `<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
  `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
  `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>`;

/** The theme carries the deck palette, so PowerPoint's own tools inherit it. */
export function themeXml(palette: Palette): string {
  const color = (name: string, value: string): string => `<a:${name}><a:srgbClr val="${value}"/></a:${name}>`;

  return (
    `${XML_HEADER}<a:theme xmlns:a="${NS_A}" name="Deck Studio"><a:themeElements>` +
    `<a:clrScheme name="Deck Studio">` +
    color("dk1", palette.ink) +
    color("lt1", "FFFFFF") +
    color("dk2", palette.darkBackground) +
    color("lt2", palette.paper) +
    color("accent1", palette.accent) +
    color("accent2", "B45309") +
    color("accent3", "1D4ED8") +
    color("accent4", "7C3AED") +
    color("accent5", "9F1239") +
    color("accent6", "334155") +
    color("hlink", "1D4ED8") +
    color("folHlink", "7C3AED") +
    `</a:clrScheme>` +
    `<a:fontScheme name="Deck Studio">` +
    `<a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
    `<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>` +
    `</a:fontScheme>` +
    `<a:fmtScheme name="Deck Studio">${THEME_FILLS}${THEME_LINES}${THEME_EFFECTS}${THEME_BACKGROUNDS}</a:fmtScheme>` +
    `</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`
  );
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
