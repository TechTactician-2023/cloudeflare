Mikrogate image display fix

The Mikrogate photo is stored at dist/assets/images/experience-mikrogate.jpg.
The experience card references /assets/images/experience-mikrogate.jpg.
The public CMS renderer now ignores invalid CMS media URLs and preserves the local image.
Experience images use a responsive fixed-height frame so the image fills the frame cleanly.

Deploy the project with dist as the Cloudflare assets directory.

Mikrogate photo update: the image now fills a square frame edge-to-edge using object-fit: cover and object-position: center 22% to keep the head visible while avoiding white bars.
