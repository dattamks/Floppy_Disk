// A single curated lowlight instance shared by the note code blocks. We register
// only the languages people actually paste into notes, so the highlighter stays
// small instead of pulling in every highlight.js grammar.
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import markdown from 'highlight.js/lib/languages/markdown';
import shell from 'highlight.js/lib/languages/shell';
import ini from 'highlight.js/lib/languages/ini';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

export const lowlight = createLowlight();
lowlight.register({
  javascript, js: javascript, jsx: javascript,
  typescript, ts: typescript, tsx: typescript,
  python, py: python,
  bash, sh: bash, zsh: bash,
  shell, console: shell,
  json,
  yaml, yml: yaml,
  css,
  xml, html: xml, svg: xml,
  sql,
  go,
  rust, rs: rust,
  java,
  c,
  cpp, 'c++': cpp,
  ruby, rb: ruby,
  php,
  markdown, md: markdown,
  ini, toml: ini,
  dockerfile,
});
