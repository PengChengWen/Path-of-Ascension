# 原型美术素材

两张场景使用 ImageGen 内置工具生成，保留独立图片作为页面美术，实际 UI 由 React 与 CSS 绘制。

## 新增人物与地图参考（尚未接入界面）

- 沈青禾立绘：`src/assets/shen-qinghe-v1.png`，1024×1536，带Alpha通道。生成记录见 [沈青禾提示词](shen-qinghe-v1.prompt.md)。
- 主角无尘立绘：`src/assets/wuchen-v1.png`，1024×1536，带Alpha通道。生成记录见 [无尘提示词](wuchen-v1.prompt.md)。
- 苍梧界世界地图UI效果图：`docs/ui/world-map-v1.png`，用于布局与美术方向参考；生成记录见 [世界地图提示词](world-map-v1.prompt.md)。图中文字与解锁状态不是实现依据。

以上均使用内置ImageGen生成；人物透明边缘包含半透明像素。地图是完整UI参考图，正式实现仍需独立底图和真实组件。

## 修炼场景

文件：`src/assets/cultivation-landscape.png`。

提示词概要：横向东方仙侠山水，层叠青灰山峰、云海、远处宗门与瀑布；右侧古松下，一位白衣修士背对镜头盘坐石台，身旁香炉。墨青与低饱和松绿，暖白晨光，细腻写实绘画结合水墨氛围。左侧与底部保持较暗，适合覆盖文字。没有文字、界面、边框或水印。

## 妖虎战斗场景

文件：`src/assets/tiger-battle.png`。

最终生成提示词：

```text
Use case: stylized-concept. One landscape 16:9 painterly environmental key art for a Chinese xianxia RPG auto-battle scene. A threatening powerful black-and-charcoal striped tiger demon, glowing restrained amber eyes, beautiful dark fur, subtle old gold natural markings, crouches on a mossy stone clearing on the RIGHT HALF of the composition facing LEFT. On the LEFT HALF, an adult Chinese male cultivator in flowing pale jade-white robes holds a straight sword, long tied dark hair, back three-quarter view looking toward the tiger. The characters should be clearly separated with an empty area between them for subtle combat effects. Full figures visible, feet grounded, not portrait. Atmospheric ancient Chinese forest with twisted pines, layered rocks and a ruined stone lantern, silver teal fog and distant crags. Premium refined painterly realistic game concept art, desaturated ink-teal greens, charcoal, pale ivory cloth, restrained warm gold sunlight. Slightly dark overall for overlaid health bars in a game. Cinematic but calm readable composition, wide camera. No text, no UI, no panels, no letters, no logos, no watermark, no gore, no cartoon, no neon, no dragons, no fire explosion.
```
