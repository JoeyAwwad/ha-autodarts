# Changelog

All notable changes of the Autodarts integration. The complete notes of every version, with each pull request, are on the [releases page](https://github.com/Dennis-Otto/ha-autodarts/releases); what comes next is in the [roadmap](docs/roadmap.md). Versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### New

- **Wild Mouse:** a fourth Cricket game, also known as Minnesota Cricket. Besides 20 to 15 and the bull, every player closes three doubles, three triples and three in a bed. A dart counts for its number while it is open, otherwise for doubles or triples; the chalkboard has a row for each, the board outlines the next target, and teams, the bot and tournaments play it too. *Three in a bed* on the new game screen, or *Practice Wild Mouse three in a bed*, leaves the bed out ([rules](docs/games.md#wild-mouse)).

## [2.0.0](https://github.com/JoeyAwwad/ha-autodarts/compare/v1.9.2...v2.0.0) (2026-10-09)


### ⚠ BREAKING CHANGES

* a major version), and its notes from what CHANGELOG.md says under Unreleased. Merging this pull request publishes it.

### Features

* a caller in the scoreboard, off by default ([7cd5c73](https://github.com/JoeyAwwad/ha-autodarts/commit/7cd5c73410aca89adfed5d8bcb6b4746fdb4c902))
* a caller in the scoreboard, off by default ([0a8664f](https://github.com/JoeyAwwad/ha-autodarts/commit/0a8664f846de2650cd656cd036c579b587a4a86b))
* add a live dartboard dashboard card ([cf3d18d](https://github.com/JoeyAwwad/ha-autodarts/commit/cf3d18dfe18baf44f77ecbf434d537eb09cc8a2d))
* add a live dartboard dashboard card ([7b2a07e](https://github.com/JoeyAwwad/ha-autodarts/commit/7b2a07e1519b5f0410ca445a1793864f7348e70b))
* Add Autodarts cloud API with OAuth2 for match/player data ([9f03e47](https://github.com/JoeyAwwad/ha-autodarts/commit/9f03e47af711e40862f78fec084471dafed74c5b))
* an automatic Autodarts dashboard (dashboard strategy) ([f19e1f4](https://github.com/JoeyAwwad/ha-autodarts/commit/f19e1f48fd0c7844f718f27e91cd057bdddb548b))
* an automatic Autodarts dashboard (dashboard strategy) ([136a1a0](https://github.com/JoeyAwwad/ha-autodarts/commit/136a1a0e51cbb6683a9dd288044dbd5f48cfb252))
* **assist:** start a game by voice ([#123](https://github.com/JoeyAwwad/ha-autodarts/issues/123)) ([efdb1b7](https://github.com/JoeyAwwad/ha-autodarts/commit/efdb1b785ff1a3552c6a8580c457fe064f343c02))
* automation blueprints for common darts automations ([f175c53](https://github.com/JoeyAwwad/ha-autodarts/commit/f175c5363d5cc0eff38fbb01b50208e622c6603a))
* automation blueprints for common darts automations ([1603a82](https://github.com/JoeyAwwad/ha-autodarts/commit/1603a8211381abeee42f1994e7e1f2b72d66cefa))
* **blueprints:** practice caller and highlight photo ([5ae4d69](https://github.com/JoeyAwwad/ha-autodarts/commit/5ae4d695fde7c3610c9591699bf5256474a4472b))
* **blueprints:** practice caller and highlight photo ([02ac9af](https://github.com/JoeyAwwad/ha-autodarts/commit/02ac9afe87912543a81e2a7f8b71395d8d7ddac9))
* **blueprints:** training session routine ([d7a0f7f](https://github.com/JoeyAwwad/ha-autodarts/commit/d7a0f7f1c827c11e39d1b51801f6b91a0ec6d0b1))
* **blueprints:** training session routine ([956db20](https://github.com/JoeyAwwad/ha-autodarts/commit/956db208315dc27c77f3b615df63c253a87e793f))
* board PC details from Board Manager 2 ([07f6eb0](https://github.com/JoeyAwwad/ha-autodarts/commit/07f6eb071647d9f689da66fd37ecfaeea16a20bd))
* board PC details from Board Manager 2 ([a6463f1](https://github.com/JoeyAwwad/ha-autodarts/commit/a6463f199cbc480b4ac1e5e42f99b38744408071))
* **camera:** live stream from Board Manager 2 ([d36f307](https://github.com/JoeyAwwad/ha-autodarts/commit/d36f307f932d484ff034775bd79984daa284b35a))
* **camera:** live stream from Board Manager 2 ([bfb39df](https://github.com/JoeyAwwad/ha-autodarts/commit/bfb39dfbb5b45a1dd389612c7f452b7af70a8e4d))
* **cards:** a loupe and zoom to correct darts on touch screens, controls for fingers on every one ([#115](https://github.com/JoeyAwwad/ha-autodarts/issues/115)) ([d80fc8b](https://github.com/JoeyAwwad/ha-autodarts/commit/d80fc8b136331dae2620317cf934a13b37b8450b))
* **cards:** correct darts on the live card; building blocks that show what a tap does ([#117](https://github.com/JoeyAwwad/ha-autodarts/issues/117)) ([2f9db30](https://github.com/JoeyAwwad/ha-autodarts/commit/2f9db30404e766bd92be6f0a9743902844e9a92d))
* **cards:** session controls, past sessions, last visits and board PC ([7ed2acf](https://github.com/JoeyAwwad/ha-autodarts/commit/7ed2acf33afd1a85ad2b5d35b174b7c65a5b4cde))
* **cards:** session controls, past sessions, last visits and board PC ([8353484](https://github.com/JoeyAwwad/ha-autodarts/commit/835348466b17acb5a03821532a3e91bfaa1cbcd3))
* **cards:** setup hints in checkout training, a safe tournament restart, export for admins ([#88](https://github.com/JoeyAwwad/ha-autodarts/issues/88)) ([71741d6](https://github.com/JoeyAwwad/ha-autodarts/commit/71741d6a381c14185748cfe422807613afcc5967))
* **cards:** what a tooltip tells, a tap shows too ([#122](https://github.com/JoeyAwwad/ha-autodarts/issues/122)) ([4519646](https://github.com/JoeyAwwad/ha-autodarts/commit/4519646784f0e9444da706a73afd946ad49cc721))
* **contrib:** 12+ players and player photos on the classic game screen ([#16](https://github.com/JoeyAwwad/ha-autodarts/issues/16)) ([1ee1ac7](https://github.com/JoeyAwwad/ha-autodarts/commit/1ee1ac7f1a3cea3beaf2349f5ef284c16ef63ae6)), closes [#15](https://github.com/JoeyAwwad/ha-autodarts/issues/15)
* **contrib:** 31 card games, teams, stats, the night's Top List and a demo for the classic game screen ([03ceb74](https://github.com/JoeyAwwad/ha-autodarts/commit/03ceb74243a019f037681529dcf191cafc7922fc))
* **contrib:** board camera window and thrower webcam with instant and slow-motion replay ([#41](https://github.com/JoeyAwwad/ha-autodarts/issues/41)) ([b8f2b47](https://github.com/JoeyAwwad/ha-autodarts/commit/b8f2b475b982271ee17a595f593ffbc3abf78498)), closes [#24](https://github.com/JoeyAwwad/ha-autodarts/issues/24)
* **contrib:** brand and moment pictures on the classic game screen ([#40](https://github.com/JoeyAwwad/ha-autodarts/issues/40)) ([10846de](https://github.com/JoeyAwwad/ha-autodarts/commit/10846de04af14f10b8fcd5052aeda23b0ce02c85)), closes [#17](https://github.com/JoeyAwwad/ha-autodarts/issues/17)
* **contrib:** correct a dart the board read wrong on the classic game screen ([#8](https://github.com/JoeyAwwad/ha-autodarts/issues/8)) ([d55d31c](https://github.com/JoeyAwwad/ha-autodarts/commit/d55d31c939ec402f74ca2dabed2383c598c2c525)), closes [#7](https://github.com/JoeyAwwad/ha-autodarts/issues/7)
* **contrib:** dart-machine look for the classic game screen ([#12](https://github.com/JoeyAwwad/ha-autodarts/issues/12)) ([f994247](https://github.com/JoeyAwwad/ha-autodarts/commit/f9942477925f330ec1acfdb12e6eebd2221a1f6d)), closes [#11](https://github.com/JoeyAwwad/ha-autodarts/issues/11)
* **contrib:** feedback on every dart, celebrations, sound and a caller ([#14](https://github.com/JoeyAwwad/ha-autodarts/issues/14)) ([ebb6345](https://github.com/JoeyAwwad/ha-autodarts/commit/ebb634526bd6f9fe3080b52bee9b9c7baf2c632d)), closes [#13](https://github.com/JoeyAwwad/ha-autodarts/issues/13)
* **contrib:** game icons, colours and an (i) rules sheet for every game ([#10](https://github.com/JoeyAwwad/ha-autodarts/issues/10)) ([3b98c2e](https://github.com/JoeyAwwad/ha-autodarts/commit/3b98c2e5123354bc113735a9f73e3b5a775e804c)), closes [#9](https://github.com/JoeyAwwad/ha-autodarts/issues/9)
* **contrib:** Home Assistant sync and control for the classic game screen ([#45](https://github.com/JoeyAwwad/ha-autodarts/issues/45)) ([0f70cc9](https://github.com/JoeyAwwad/ha-autodarts/commit/0f70cc9b3ad9e2f87a7d810e9f99920da472688f)), closes [#25](https://github.com/JoeyAwwad/ha-autodarts/issues/25)
* **contrib:** machine-style cricket boards and Wild Mouse auto-next ([#44](https://github.com/JoeyAwwad/ha-autodarts/issues/44)) ([c6062bc](https://github.com/JoeyAwwad/ha-autodarts/commit/c6062bcdb1b2545ce949d42e4ab679540af9aa6a)), closes [#26](https://github.com/JoeyAwwad/ha-autodarts/issues/26)
* **contrib:** own names for the arcade games, Joey back in the examples ([f0e88fd](https://github.com/JoeyAwwad/ha-autodarts/commit/f0e88fdfd034c1e3b858bca2016038a7c6e18566))
* **contrib:** play Wild Mouse on the integration where it has the game ([93bad3b](https://github.com/JoeyAwwad/ha-autodarts/commit/93bad3b0535e17c01c1a058e9c3c2a16ed7d477d))
* **contrib:** stuck_takeout_reset option for the classic game screen ([#5](https://github.com/JoeyAwwad/ha-autodarts/issues/5)) ([04b0fbf](https://github.com/JoeyAwwad/ha-autodarts/commit/04b0fbf9bef92c960517b8e3c982eada1dc37855)), closes [#2](https://github.com/JoeyAwwad/ha-autodarts/issues/2)
* **contrib:** sync with upstream v1.9.2 and bring the classic game screen up to date ([116a296](https://github.com/JoeyAwwad/ha-autodarts/commit/116a2961ad44567a9d5483e6bb9e007869e6bd87))
* Cricket as a practice game with a chalkboard in the live card ([faff995](https://github.com/JoeyAwwad/ha-autodarts/commit/faff995850660a08e8152f602013ab307d2503ee))
* Cricket as a practice game with a chalkboard in the live card ([0dda6f6](https://github.com/JoeyAwwad/ha-autodarts/commit/0dda6f6ca32544b16ab2936205d7b5b4b39e8228))
* **dashboard:** the game settings get a view of their own ([#121](https://github.com/JoeyAwwad/ha-autodarts/issues/121)) ([ca17018](https://github.com/JoeyAwwad/ha-autodarts/commit/ca170180aa6696e4a9a4a7a2571d26b8e3ae9b6f))
* doubles analysis, a doubles card and personal checkout routes ([57894d7](https://github.com/JoeyAwwad/ha-autodarts/commit/57894d73119e510c744273c676054ddd9e70381d))
* doubles analysis, a doubles card and personal checkout routes ([a5733a0](https://github.com/JoeyAwwad/ha-autodarts/commit/a5733a0300d257e6f17e290ff16a5f3c1ddcd6ad))
* **doubles:** count every double hit, with the rate where darts were aimed ([#114](https://github.com/JoeyAwwad/ha-autodarts/issues/114)) ([0a18093](https://github.com/JoeyAwwad/ha-autodarts/commit/0a18093e184ac50a357f9bbb458ce90b2d6be9cd))
* **games:** Wild Mouse, Cricket with doubles, triples and three in a bed ([#171](https://github.com/JoeyAwwad/ha-autodarts/issues/171)) ([d678887](https://github.com/JoeyAwwad/ha-autodarts/commit/d6788877e8cd1d1016469273f12984d116918033))
* **i18n:** Dutch, French and Spanish ([#79](https://github.com/JoeyAwwad/ha-autodarts/issues/79)) ([9c0af08](https://github.com/JoeyAwwad/ha-autodarts/commit/9c0af0823080133b6ab105c07a4ba08c500e0f59))
* **issues:** add a tester report form for experiences from real boards ([#101](https://github.com/JoeyAwwad/ha-autodarts/issues/101)) ([435bc3a](https://github.com/JoeyAwwad/ha-autodarts/commit/435bc3a64c1525018a16c8091d41d8dda7fe90e6))
* meet the Home Assistant quality scale rules ([11cd829](https://github.com/JoeyAwwad/ha-autodarts/commit/11cd82906870af82964b540951af15cedd2f2e82))
* meet the Home Assistant quality scale rules ([2704c16](https://github.com/JoeyAwwad/ha-autodarts/commit/2704c167bbb063e5b54b439cccae70d2958f5d54))
* **online:** bring moments of online matches into Home Assistant ([#71](https://github.com/JoeyAwwad/ha-autodarts/issues/71)) ([3f46efb](https://github.com/JoeyAwwad/ha-autodarts/commit/3f46efb3ea011633fc5337d63b4b22df941f8e9e))
* personal bests, a training streak and a daily goal ([a5cef4d](https://github.com/JoeyAwwad/ha-autodarts/commit/a5cef4d93c9abc80097df82487f2b2d1f215e9f0))
* personal bests, a training streak and a daily goal ([552aff8](https://github.com/JoeyAwwad/ha-autodarts/commit/552aff8ad314aae3e540aac1a9d72f609fa6f2ec))
* player profiles, match history and head-to-head records ([b0553ef](https://github.com/JoeyAwwad/ha-autodarts/commit/b0553ef25d6b68ef4b5ccbeb1f49f285ece2d159))
* player profiles, match history and head-to-head records ([3529392](https://github.com/JoeyAwwad/ha-autodarts/commit/3529392149024043bb9b88cdd1071a8785106ea1))
* **practice:** a bot opponent, dart corrections, a keypad and setup hints ([#81](https://github.com/JoeyAwwad/ha-autodarts/issues/81)) ([b710f04](https://github.com/JoeyAwwad/ha-autodarts/commit/b710f046090a5f86e68561c3f914c16e532605c1))
* **practice:** a match summary, real final scores and a clearer bull-off ([#75](https://github.com/JoeyAwwad/ha-autodarts/issues/75)) ([1d0c24d](https://github.com/JoeyAwwad/ha-autodarts/commit/1d0c24dd73912656a818dbe454c0b741dee5a920))
* **practice:** corrected darts keep no misread position, or the one the correction gives ([#95](https://github.com/JoeyAwwad/ha-autodarts/issues/95)) ([90e5004](https://github.com/JoeyAwwad/ha-autodarts/commit/90e500404dceec27fe5e81f9ace6b77248c7cb38))
* **practice:** first-9 average, checkout rate, doubles rate and legs ([8d74649](https://github.com/JoeyAwwad/ha-autodarts/commit/8d746495077ab847601a9d34062b7be50b1a5deb))
* **practice:** first-9 average, checkout rate, doubles rate and legs ([af2c586](https://github.com/JoeyAwwad/ha-autodarts/commit/af2c5866883f10042ab9532706ac8ef7bb2f3b87))
* **practice:** handicap starts, teams, Cricket variants and seven new games ([#74](https://github.com/JoeyAwwad/ha-autodarts/issues/74)) ([4fc77ae](https://github.com/JoeyAwwad/ha-autodarts/commit/4fc77aeffa720e4a21afe100731c03b1a9a8e3e2))
* **practice:** training games Around the Clock, doubles, checkout and Bob's 27 ([2258d13](https://github.com/JoeyAwwad/ha-autodarts/commit/2258d13c8a6b3088611bf210675be6164038b700))
* **practice:** training games Around the Clock, doubles, checkout and Bob's 27 ([f6044e8](https://github.com/JoeyAwwad/ha-autodarts/commit/f6044e84a2a736dc28e09f21c30fbaf978917631))
* **practice:** X01 matches for up to four players ([c61aacd](https://github.com/JoeyAwwad/ha-autodarts/commit/c61aacd52337566948cf6a5fc10f5904862a0b8f))
* **practice:** X01 matches for up to four players ([1ab3a0a](https://github.com/JoeyAwwad/ha-autodarts/commit/1ab3a0a792d67476f21042089880fe0a91138729))
* **practice:** X01 practice games with busts and checkout routes ([a59c33c](https://github.com/JoeyAwwad/ha-autodarts/commit/a59c33c29660baf9c9629e037532be3e79d04233))
* **practice:** X01 practice games with busts and checkout routes ([f0f10c4](https://github.com/JoeyAwwad/ha-autodarts/commit/f0f10c44db5c80cac2cc2919146373011bcc1ead))
* **progress:** achievements, trends, dart positions, grouping and a leaderboard ([#76](https://github.com/JoeyAwwad/ha-autodarts/issues/76)) ([6356716](https://github.com/JoeyAwwad/ha-autodarts/commit/6356716ea4f4cd003a35790f135a7b90cd82f7d8))
* **reports:** weekly report, training calendar and export ([#72](https://github.com/JoeyAwwad/ha-autodarts/issues/72)) ([f0d506c](https://github.com/JoeyAwwad/ha-autodarts/commit/f0d506cf25821503ba3ef8c03e99766a4918b7e6))
* scoreboard card and a full-screen scoreboard view ([a5ea073](https://github.com/JoeyAwwad/ha-autodarts/commit/a5ea073b663f080fbdd91be1b7afd145e9564e67))
* scoreboard card and a full-screen scoreboard view ([e2beb76](https://github.com/JoeyAwwad/ha-autodarts/commit/e2beb763faa4ddc60db906133c8efa6cffe9678f))
* **scoreboard:** a game lobby, idle mode, player pictures and a highlight gallery ([#73](https://github.com/JoeyAwwad/ha-autodarts/issues/73)) ([b486149](https://github.com/JoeyAwwad/ha-autodarts/commit/b4861490fd123b238c9fc3921419d12761e5ae32))
* **sessions:** tell why a session started ([eb238ca](https://github.com/JoeyAwwad/ha-autodarts/commit/eb238cafe42fa78b5c449a180114d39b78ba5bbd))
* Shanghai, Halve-It and Killer, X01 from 101 to 1001, double in and bull-off ([6f83fb9](https://github.com/JoeyAwwad/ha-autodarts/commit/6f83fb9b9df9ba06178dbee0e9543b2d491dd587))
* Shanghai, Halve-It and Killer, X01 from 101 to 1001, double in and bull-off ([7ee7bcf](https://github.com/JoeyAwwad/ha-autodarts/commit/7ee7bcf39c24f79159f04c696c95cea0c863238d))
* start_game action and detection quality with a calibration repair ([8318b76](https://github.com/JoeyAwwad/ha-autodarts/commit/8318b765c6ba2bc91d513d76102773f2a5fa1ced))
* start_game action and detection quality with a calibration repair ([856086f](https://github.com/JoeyAwwad/ha-autodarts/commit/856086f8bbc66bb52efc76a24e654dc45e930fac))
* strict typing, completing the Platinum rules of the quality scale ([ed07c32](https://github.com/JoeyAwwad/ha-autodarts/commit/ed07c3212f92831b2bfcfd479aca8f083bc53c24))
* strict typing, completing the Platinum rules of the quality scale ([54d33f1](https://github.com/JoeyAwwad/ha-autodarts/commit/54d33f164b4a31ab4d1825347f2c3c44183da19d))
* support Board Manager 2 and discover boards automatically ([bd067a6](https://github.com/JoeyAwwad/ha-autodarts/commit/bd067a673584c2cc1fd3d3935220fb37c542d6de))
* support Board Manager 2 and discover boards automatically ([88a6387](https://github.com/JoeyAwwad/ha-autodarts/commit/88a6387d62288c418ef297982ed2938171a25109))
* **tournament:** round robin and knockout tournaments for three to eight players ([#78](https://github.com/JoeyAwwad/ha-autodarts/issues/78)) ([1c112a2](https://github.com/JoeyAwwad/ha-autodarts/commit/1c112a238cd58470229b7b6d6a84f2bc97cbf799))
* training analytics, a training card and a board status card ([95638c7](https://github.com/JoeyAwwad/ha-autodarts/commit/95638c770eac81002926cffb828b101faece24ec))
* training analytics, a training card and a board status card ([f0c9033](https://github.com/JoeyAwwad/ha-autodarts/commit/f0c9033216e4363547e975bb2c5baee1a97fe9d8))
* training sessions with start, end, pauses and history ([bb9efcc](https://github.com/JoeyAwwad/ha-autodarts/commit/bb9efcccf006fc8dacc3fe3be6615bfcf508a67a))
* training sessions with start, end, pauses and history ([c3ea0ac](https://github.com/JoeyAwwad/ha-autodarts/commit/c3ea0ac4113001d8e95850705deee90a4922dee8))
* units for the training statistics ([068a027](https://github.com/JoeyAwwad/ha-autodarts/commit/068a02733d4d8a420a2dab8f6c8199384025a832))
* units for the training statistics ([b0914fb](https://github.com/JoeyAwwad/ha-autodarts/commit/b0914fb84de897189466953bed5f952c4cf7e932))


### Bug fixes

* a Board Manager restart no longer reports a false error ([e1315d8](https://github.com/JoeyAwwad/ha-autodarts/commit/e1315d83df0ff1ae3f538a631d9547630c1b7573))
* a Board Manager restart no longer reports a false error ([88b0e38](https://github.com/JoeyAwwad/ha-autodarts/commit/88b0e389420ac369e7ef071a092367f69912a75d))
* **actions:** admin-only player data, safe exports, confirmed board moves ([#86](https://github.com/JoeyAwwad/ha-autodarts/issues/86)) ([9051882](https://github.com/JoeyAwwad/ha-autodarts/commit/905188240aa508bcfff015bdf4310205b1d6d6d5))
* allow thirty minutes for release workflow registration ([#4](https://github.com/JoeyAwwad/ha-autodarts/issues/4)) ([fd8ab4b](https://github.com/JoeyAwwad/ha-autodarts/commit/fd8ab4bdf880f7b3a9fddcdb2c5f227673002d4e))
* auto-discover local board from cloud API for last_throw sensor ([1f2511f](https://github.com/JoeyAwwad/ha-autodarts/commit/1f2511f0a1f2772c5b1d0d7fafd1aed6ee7754b7))
* **blueprints:** leave the bot out, keep every moment; complete the 1.6.0 docs ([#85](https://github.com/JoeyAwwad/ha-autodarts/issues/85)) ([ee8f8e3](https://github.com/JoeyAwwad/ha-autodarts/commit/ee8f8e34b042a81c79a71ef5e4558bc138dd94d2))
* **blueprints:** react in time, stay quiet when asked and add a light show ([#66](https://github.com/JoeyAwwad/ha-autodarts/issues/66)) ([09d2ba7](https://github.com/JoeyAwwad/ha-autodarts/commit/09d2ba7e5fa58b790ae93b06663bac6abb4393d6))
* **bm2:** read the cameras right after the detection starts or stops ([7819065](https://github.com/JoeyAwwad/ha-autodarts/commit/78190651a48627fff9d3cd137dd9e36f4d1d55e8))
* **bm2:** read the cameras right after the detection starts or stops ([7edfe45](https://github.com/JoeyAwwad/ha-autodarts/commit/7edfe454e0af623605469d3f904f8fc6589c010a))
* **brand:** export icons and logos to the Home Assistant specification ([#62](https://github.com/JoeyAwwad/ha-autodarts/issues/62)) ([daabddd](https://github.com/JoeyAwwad/ha-autodarts/commit/daabddd9bf636cb3947f92e9dace8dff66c520ab))
* **card:** crisp visit history bars and a heat scale that matches its legend ([d8d74c2](https://github.com/JoeyAwwad/ha-autodarts/commit/d8d74c2f923aa8418426d37eaee9e777aad4b519))
* **cards:** accept only valid CSS colours for accent and highlight ([1931ddd](https://github.com/JoeyAwwad/ha-autodarts/commit/1931ddd4ba588224c8f26ace511c792b46802b0e))
* **cards:** fit every screen on phones and tablets, tested by taps on eight sizes ([#113](https://github.com/JoeyAwwad/ha-autodarts/issues/113)) ([746b80e](https://github.com/JoeyAwwad/ha-autodarts/commit/746b80e773be4fef2b933f53e38508f52762f03c))
* **cards:** fit the scoreboard to every screen, follow every visit and read out what matters ([#82](https://github.com/JoeyAwwad/ha-autodarts/issues/82)) ([8aafe0a](https://github.com/JoeyAwwad/ha-autodarts/commit/8aafe0a81c9165bbc9563e2d0c2cf1893f7475c8))
* **cards:** keep visits of the previous session out of a new one ([1e0d188](https://github.com/JoeyAwwad/ha-autodarts/commit/1e0d188e634476ef1b6201d855a7f8986f4ffe46))
* **cards:** native editor forms, fair calls, locale formats and shared game views ([#67](https://github.com/JoeyAwwad/ha-autodarts/issues/67)) ([a4433df](https://github.com/JoeyAwwad/ha-autodarts/commit/a4433dfe1a9202a4ef9f44a97e3e232c1ee383c7))
* **cards:** nothing moves while a game goes on ([#119](https://github.com/JoeyAwwad/ha-autodarts/issues/119)) ([ad5862c](https://github.com/JoeyAwwad/ha-autodarts/commit/ad5862c8b69ce1486b1e023648606619aabf5738))
* **cards:** open the help of the cards on the documentation website ([#167](https://github.com/JoeyAwwad/ha-autodarts/issues/167)) ([ca8b5e5](https://github.com/JoeyAwwad/ha-autodarts/commit/ca8b5e519135d76c6b9273e2091080245aca72b6))
* **cards:** pass an axe-core accessibility check ([#147](https://github.com/JoeyAwwad/ha-autodarts/issues/147)) ([b283c22](https://github.com/JoeyAwwad/ha-autodarts/commit/b283c222affb70fbfdc435e36c3d77d8d583719a))
* **cards:** polish every screen from a phone to a 27 inch touch monitor ([#116](https://github.com/JoeyAwwad/ha-autodarts/issues/116)) ([3ede32b](https://github.com/JoeyAwwad/ha-autodarts/commit/3ede32bb344f88455f7e5f8e4f1edfb3acdfe2a7))
* **cards:** show the darts of the current visit in the positions heatmap at once ([#94](https://github.com/JoeyAwwad/ha-autodarts/issues/94)) ([67b8820](https://github.com/JoeyAwwad/ha-autodarts/commit/67b88200e4e64715b50e10f16b080403e38b2923))
* **cloud:** no dead end while Autodarts has not issued a client ID ([1899e34](https://github.com/JoeyAwwad/ha-autodarts/commit/1899e34fe4d2344c5fbb37792c84b9407350353d))
* complete all commit checks before publishing releases ([#7](https://github.com/JoeyAwwad/ha-autodarts/issues/7)) ([39745f5](https://github.com/JoeyAwwad/ha-autodarts/commit/39745f50a3c8d41c51cc9e2251789cf349ba9fb6))
* **connection:** keep visits and entities through board connection faults ([#69](https://github.com/JoeyAwwad/ha-autodarts/issues/69)) ([fdc57a4](https://github.com/JoeyAwwad/ha-autodarts/commit/fdc57a4cf65db6129c5a2a4593ee6fdbb5d2d5ea))
* **contrib:** keep the board's darts out of the screen's HTML ([46b024e](https://github.com/JoeyAwwad/ha-autodarts/commit/46b024ecb73b1430287aa789522ee6f31e8fd913))
* **contrib:** keep the board's darts out of the screen's HTML ([621cd47](https://github.com/JoeyAwwad/ha-autodarts/commit/621cd47ba9a0eda7043988d043e248adfe612634))
* **contrib:** keep three in a bed through a reload, save the setup once ([#6](https://github.com/JoeyAwwad/ha-autodarts/issues/6)) ([310149d](https://github.com/JoeyAwwad/ha-autodarts/commit/310149d96109cabf4a255a61567b63d2411c67dc)), closes [#3](https://github.com/JoeyAwwad/ha-autodarts/issues/3)
* **contrib:** pass shellcheck and the Markdown lint ([c01e1f0](https://github.com/JoeyAwwad/ha-autodarts/commit/c01e1f082e8f0d732fc9cb0110ccf593272458b8))
* **dashboard:** name rows without the board and their section ([ea82c70](https://github.com/JoeyAwwad/ha-autodarts/commit/ea82c70d3bef377e00287016b380bbd9e5ec3c26))
* **dashboard:** name rows without the board and their section ([a767b4f](https://github.com/JoeyAwwad/ha-autodarts/commit/a767b4f13521e2da1719418c466a3190b10ca1cd))
* **games:** correct rules of Golf, Catch 40, 121, Cut-Throat and the tournament ([#84](https://github.com/JoeyAwwad/ha-autodarts/issues/84)) ([e915af9](https://github.com/JoeyAwwad/ha-autodarts/commit/e915af91c5e9daf68c344dc5a37cb8086e03c154))
* **integration:** complete diagnostics, clearer names and consistency tests ([#70](https://github.com/JoeyAwwad/ha-autodarts/issues/70)) ([65038a2](https://github.com/JoeyAwwad/ha-autodarts/commit/65038a288c4080e4031da33b82ac208e828825d6))
* keep stored data safe and count every statistic once ([#83](https://github.com/JoeyAwwad/ha-autodarts/issues/83)) ([f75eb4c](https://github.com/JoeyAwwad/ha-autodarts/commit/f75eb4cbfcd26e91bdecfe006eeb0638b4fbcb77))
* player names, scores, stats, and darts thrown sensors ([911d365](https://github.com/JoeyAwwad/ha-autodarts/commit/911d365df68c8e10ad2b9a93d8cfb3d4888a7e1e))
* **practice:** name the leg counter practice legs played ([a7023f5](https://github.com/JoeyAwwad/ha-autodarts/commit/a7023f58e379d82fee3248ac4148fe318af4a4bd))
* **practice:** play every game by the official rules ([#68](https://github.com/JoeyAwwad/ha-autodarts/issues/68)) ([acb0f43](https://github.com/JoeyAwwad/ha-autodarts/commit/acb0f437cb78c83d231b03e4b04006030a6c4ef3))
* record deployments only for release publication ([57e8add](https://github.com/JoeyAwwad/ha-autodarts/commit/57e8add842c2593e87d4da6dd183927e7a955b14))
* record deployments only for release publication ([a40af6f](https://github.com/JoeyAwwad/ha-autodarts/commit/a40af6fd34555e842c61732a97b685db6cf014fd))
* recover reliably from board, network and cloud failures ([f9269d1](https://github.com/JoeyAwwad/ha-autodarts/commit/f9269d19e0fa5a5ab1db6b47f5d1665c368e86a4))
* recover reliably from board, network and cloud failures ([833112d](https://github.com/JoeyAwwad/ha-autodarts/commit/833112d8fc9dc8bd6bc3fede0f1396901b650dab))
* run protected release PRs through the release app ([#5](https://github.com/JoeyAwwad/ha-autodarts/issues/5)) ([7801972](https://github.com/JoeyAwwad/ha-autodarts/commit/7801972bd84442c17a7a2ba37dceb0534273dffd))
* show a switched board setting at once when a poll read the old one ([#110](https://github.com/JoeyAwwad/ha-autodarts/issues/110)) ([ad7ca87](https://github.com/JoeyAwwad/ha-autodarts/commit/ad7ca872de0f6c6883d770573de3037d69d97540))
* switch to OAuth2 Authorization Code + PKCE flow ([7966203](https://github.com/JoeyAwwad/ha-autodarts/commit/796620399d625211f440e61f14ecea65089a4f5a))
* tolerate delayed registration of release PR checks ([#3](https://github.com/JoeyAwwad/ha-autodarts/issues/3)) ([1ae5645](https://github.com/JoeyAwwad/ha-autodarts/commit/1ae564599829f33c8da235ea34b5d29d57513708))
* **training:** draw only the darts that landed on the board ([#112](https://github.com/JoeyAwwad/ha-autodarts/issues/112)) ([00f4001](https://github.com/JoeyAwwad/ha-autodarts/commit/00f4001b49b380133b9620430dca8b8c23c23ad5))
* treat the session Home Assistant closes on shutdown as a lost connection ([#108](https://github.com/JoeyAwwad/ha-autodarts/issues/108)) ([83468e6](https://github.com/JoeyAwwad/ha-autodarts/commit/83468e6dcb34ac032a963e3804774901aa5db728))
* undo, player names and rule guards; a sharper test suite ([#89](https://github.com/JoeyAwwad/ha-autodarts/issues/89)) ([c25c169](https://github.com/JoeyAwwad/ha-autodarts/commit/c25c1694241d08ee41a9baf7b7c2b6507ffb3d43))
* wait for all release merge protection checks ([#6](https://github.com/JoeyAwwad/ha-autodarts/issues/6)) ([ebdfc18](https://github.com/JoeyAwwad/ha-autodarts/commit/ebdfc187a91bcceb2c7f88dd7d135ed510ad1911))


### Miscellaneous

* release 1.9.2 ([#168](https://github.com/JoeyAwwad/ha-autodarts/issues/168)) ([9c4b21c](https://github.com/JoeyAwwad/ha-autodarts/commit/9c4b21cf56a19d2b9c22a6c7639c660c63ed045c))

## [1.9.2](https://github.com/Dennis-Otto/ha-autodarts/compare/v1.9.1...v1.9.2) (2026-10-08)

### New

- **Betas for testers:** every change for users becomes a beta of the next release within minutes, which HACS offers to those who turn on the switch *Pre-release* of the integration ([how](docs/installation.md#betas-for-testers)).

### Changed

- **Help on the documentation website:** the help links of the cards in the card picker and of the automatic dashboard, and the documentation link of the integration, open the [documentation website](https://dennis-otto.github.io/ha-autodarts/) instead of GitHub, in German when Home Assistant speaks German.

### Documentation

- The website switches between English and German on every page, with German menus, search and dates, and starts with a page of its own for each language. The German pages moved next to the English ones, such as `docs/games.de.md` next to `docs/games.md`; the old addresses of the German overview and card guide lead there.

## [1.9.1](https://github.com/Dennis-Otto/ha-autodarts/compare/v1.9.0...v1.9.1) (2026-10-07)

### Fixed

- **Readable badges:** the words under a badge of the players card, such as when it was earned, had too little contrast on the gold of the badge in the dark theme. They now take the muted text of every other card and reach the contrast that WCAG 2.1 AA asks for.
- **The keyboard reaches the scores:** when the pad leaves a full-height scoreboard on a phone too little room, its scores scroll. A keyboard can now reach and scroll them as well, and a screen reader names them *Scoreboard*.

### Documentation

- The accessibility check of the cards, which axe-core runs in the browser test on a laptop and a phone in both themes.

## 1.9.0

### New

- **Start a game by voice:** a new blueprint lets Assist start a practice game, for example "Starte 501 für Alex und Sam", "Start the game Cricket for Alex" or "Spiele 501 gegen den Bot", in German or English. Assist answers with the game and the players, or with what was wrong. Every sentence has a number from 101 to 1001 or the word "Spiel" or "game", so Assist's own commands, such as a timer, stay its own (#123).
- **`autodarts.start_game` understands a voice:** a game by its name in any language of the integration, such as "Around the Clock" or "Doppeltraining", or by the beginning of a name that fits one game alone; a player's name in the spelling of the player's profile; and with `response_variable`, an answer in words to say instead of a failure (#123).
- **Hints on a tap:** what a mouse shows as a tooltip, a tap with a finger or a pen now shows in a small bubble over the card, without moving anything: the darts of a last visit, a visit in the training chart, a trend arrow, a double, the columns of a tournament's table, a camera's dot and the hint of a setup (#122).

### Changed

- **Game settings in a view of their own:** the live view of the automatic dashboard shows the live card alone. The rows of the practice game, its players, start scores and the tournament moved to the new view *Game settings* (#121).

### Documentation

- The voice blueprint with its sentences, the names and the answer of the start action, the new view and the hint building block, in English and German, with the screenshots and animations recorded anew. The example of an automation of your own no longer catches "start a timer for 5 minutes".

## 1.8.1

### Fixed

- **Nothing moves while a game goes on:** the scoreboard's tiles grew and shrank with what they showed: the average after the first dart, a route or a setup that took another line on a narrow tile, the points under a thrown dart, and *Undo last visit* as a row of its own after every takeout, which also shrank the numbers of a full-height scoreboard. Every tile, the visit and the Cricket chalkboard now keep their height from the start of a game to its last dart, on every screen from a 360 pixel phone to a 27 inch monitor, and the new browser step *steady heights* keeps it so (#119).
- **The status** keeps the width of its longest words during a game, so *Remove your darts* no longer pushes the scoreboard's buttons onto another line on a phone.
- **Training games:** the checkout rate and the best show a dash until they are known, and a narrow screen lays the facts out in columns; the live card's training head has a line for the game and one for what it says.

### Changed

- **Undo the last visit:** the tile beside the darts shows the last visit while the board is empty, between games too, with a curved arrow where a tap can take it back; a second tap on the red *Undo?* does it. The button below the visit is gone.
- **Killer notes** are shorter in German, Spanish, French and Dutch, so they fit one line.

### Documentation

- The README's animation is recorded anew with tiles that hold still, and the development guide has the rule that nothing moves during a game.

## 1.8.0

### New

- **Correct darts on the live card:** a tap on a dart of the visit opens the scoreboard's pad below the darts, with its keys, its board, the loupe and the zoom. A pencil at the top right marks every dart a tap corrects. The new option `corrections` switches it off.
- **Loupe and zoom on touch screens:** on a small screen, the board of a correction opens zoomed in on where the board saw the dart. A finger held on the board shows a loupe above it and sets the dart where it lets go; two fingers zoom and move the board. A round magnifier switches between the zoomed part and the whole board. The loupe and the fingers work on every touch screen, a 24 or 27 inch touch monitor too.
- **Every double hit counts:** the doubles card counts every double any dart hits, in every game and in plain training, next to the rate where darts were aimed at a double. The doubles sensor carries them as `landed`.

### Improved

- **Phones, tablets and touch monitors:** every card fits and reads well from a 360 pixel phone to a 27 inch touch monitor, upright and on its side. The full-height scoreboard stays one screen high, the board to tap fills the room the scores leave, keys grow on large screens, and every control is at least 40 pixels for a finger on any touch screen, also with a mouse plugged in.
- **Clear at a glance:** a pencil shows what a tap edits, an arrow what a tap opens; static parts such as the player tiles, the visit's total, the status and the beds of a route no longer look like buttons. The second tap that confirms is red on every card, the pad says why it waits while the bot throws, and the new game screen says why a player sits out. States change with calm animations, and not at all where the device asks for less motion.
- **The badge gallery** shows each player's badges earned and the three nearest goals; *All 18 badges* opens the rest.
- **Trends** run on through weeks without darts, and a figure without two halves to compare shows no arrow.
- **Grids** keep a tile from standing alone in a last row: four players stand two by two rather than three and one.

### Fixed

- **The scoreboard on a phone** was cut off at the bottom, and the new game screen's start bar showed what scrolled beneath it.
- **The positions heatmap** drew darts that landed beside the board; only darts on the board show (#112).
- **The doubles card** stayed empty after a game with doubles in it.
- **On a phone on its side,** the board to tap was only 160 pixels high, and a zoomed board drew over the keys.
- **A finger on the board to tap** could outlast a pad that closed under it, and later boards no longer redrew.

### Changed

- **Shorter entity names** where Home Assistant's rows cut them: *Distortion correction* instead of *Automatic distortion correction* in every language, and in German *Übungsspiel neues Match*, *Übungsspiel neues Leg* and *Turnier Dauer der Zusammenfassung*. Existing entity ids stay; a new installation names the distortion switch `switch.<board>_distortion_correction`.
- **Taps that opened details unannounced:** the training card's tiles open nothing any more, *Details* below them does; the live card's board is a picture. The status card's own calibration reads *Calibrate all*.

### Documentation

- The loupe, the zoom and touch monitors, correcting on the live card with a new animation, and the UI building blocks in the development guide.

## 1.7.1

### Fixed

- **No error in the log when Home Assistant restarts:** a board poll that started after Home Assistant had closed its connections logged *Unexpected error fetching autodarts_local data* with a traceback. It now counts as an ordinary lost connection, like the event stream, the camera stream and the cloud requests. Reported by @JoeyAwwad in #107.
- **Board settings show at once:** with Board Manager 1, a setting switched on or off, such as *Auto distortion*, could show its old value for up to 30 seconds when a poll was reading the settings at that moment.

### Documentation

- **Autodarts Desktop on Linux** is listed under the supported devices: a player reported version 2.0.2 on Ubuntu 24.04 working with every feature (#105). Autodarts Desktop on Windows is still untested; a compatibility report helps.

## 1.7.0

### New

- **Where a corrected dart really is:** the scoreboard's pad has a new *🎯 Board* view. Tap the spot where the dart is, and the bed and the position come in one step; a dashed ring shows where the board saw the dart. The keypad for darts entered by hand uses it too. `autodarts.correct_dart` and `autodarts.throw_dart` take the position as `x` and `y`, and the bed follows from it.

### Improved

- **Live dart positions:** the positions heatmap of the training card shows the darts of the current visit the moment they land, as blue pins, and loads the logged darts again as soon as you pull them, instead of a visit later.
- **Clean positions after corrections:** where the board misread a bed, it misread the spot as well. A dart corrected into another bed therefore leaves the board's position behind and stays out of the dart positions, the grouping and a bull-off by distance, unless the correction says where the dart is.

## 1.6.0

### New

- **More games:** Cut-Throat Cricket and Tactics; the party games Golf (9 or 18 holes), Baseball and Count-Up; the training games 121 checkout, Catch 40, JDC Challenge and singles training.
- **Handicap and teams:** every player can start X01 from a score of their own, and four players play X01 or a Cricket game as two teams of two.
- **Tournaments** for three to eight players at one board: a round robin with a table or a knockout with a bracket, in X01 with start scores or a Cricket game; the next match starts by itself, the results go into the player profiles, and `autodarts.start_tournament`, `autodarts.next_tournament_match` and `autodarts.stop_tournament` run them from automations.
- **Match summary:** after an X01 or Cricket match, the scoreboard and the live card show every player's averages, checkout rate, highest checkout, 180s and best leg; `match_won` carries the numbers, and the winner's banner names the result, such as 3 : 2.
- **A bot** to play X01 and the Cricket games against, from level 20 to 120: it aims like a player, its darts land with a scatter calibrated to its 3-dart average and show on the cards, and it never counts in your statistics. Seat it on the new game screen, with *Practice bot level* or with `bot_level` of `autodarts.start_game`.
- **Corrections and darts entered by hand:** a tap on a dart of the scoreboard, or `autodarts.correct_dart`, corrects a dart the board read wrong; with *Practice manual entry*, a keypad or `autodarts.throw_dart` enters darts the board missed; `autodarts.next_player` passes the turn, and `autodarts.undo_visit` takes the last visit back, with the new `visit_undone` event.
- **Setup hints:** where the darts left cannot check out, the cards, `turn_changed` and the callers suggest a setup that leaves a good double, such as T20 T20 S17 to leave 32.
- **Achievements** in bronze, silver, gold and platinum, from the first 180 to a nine-darter, with the `achievement_unlocked` event and badges on the players card.
- **Player progress:** twelve weeks of trends per player, a heatmap of the real dart positions for the session or any player, the grouping of the darts in millimeters, and a new leaderboard card with the records of all players.
- **A game lobby on the scoreboard:** a new game screen to choose the game, the players and the format at the board, idle mode with a leaderboard, personal bests, today's darts, the last match and a clock, and the pictures of players linked to persons of Home Assistant with `autodarts.link_player` and `autodarts.unlink_player`.
- **Reports:** a weekly report with its sensor, the `weekly_report` event and a blueprint; a training calendar of the last 365 days; `autodarts.export` and an export button on the players card for CSV or JSON.
- **Highlights and light:** a highlight gallery in the media browser, fed by the highlight photo blueprint, and a new light show blueprint for WLED and room lights.
- **Online matches** *(experimental)*: an optional bridge brings busts, won legs and matches and the darts of opponents on play.autodarts.io into Home Assistant through the browser extension Tools for Autodarts.
- **Dutch, French and Spanish:** the integration, the cards and the caller speak three more languages.
- **Events in time:** `visit_thrown` announces a visit the moment its third dart lands; dart and visit events name the game and the player.
- **Bull-off by distance:** optionally, the measured distance also decides between two darts in the same bull bed. The scoreboard shows the bed and the distance of every dart and who leads.
- **Double out from the next leg:** switching double out during a leg applies from the next leg, so no leg becomes unwinnable.

### Improved

- **Official rules:** the throw alternates within a set and every set starts with the next player, as in PDC set play; a match ends 3–2 instead of losing the legs of the deciding set; checkout routes follow the professional charts; highest checkout and fewest darts count only legs with double out; Killer and Shanghai follow their rules in every detail.
- **Cards:** Home Assistant's own editor forms with color pickers, an editor for the automatic dashboard, personal bests on the training card, numbers, dates and times in the formats of your profile, a caller that calls only what counts, and better keyboard and screen reader support.
- **Connection:** visits and entities survive short connection faults; realtime reconnects with a back-off; a board that is off at the start no longer blocks the setup; repairs for a board that refuses access, answers in an unknown format or moved to a new address.
- **Entities:** clearer names without a repeated "Board", diagnostic and configuration categories where they belong, and complete diagnostics without player names.
- **Safe statistics:** a board whose stored training cannot be read right now, or was saved by a newer version, waits instead of starting empty, so its data is never overwritten. Every leg and visit counts once in the statistics, undo also rewinds the progress, the weekly report and the calendar, and in a team match only the player who checks out gets the checkout.
- **Rules:** Golf counts a double as a hole in one and a triple as two strokes; in the checkout training, the 121 checkout and Catch 40 a bust voids only its visit, the 121 checkout plays every score up to 170, and Catch 40 scores 3 points for 99 in three darts; Cut-Throat Cricket checks the win after every dart; a tournament hands the practice game its players and settings back when it ends; the bot plays Cricket at the marks per round of its level.
- **Scoreboard:** fits every screen, with the pad and the keypad beside the scores on a full-height screen in landscape; starting a game in the lobby also starts the detection; the automatic dashboard sets the scoreboard's caller, keypad, corrections, lobby games and idle panels without taking control; the training card's chart follows the history live, and an undone visit leaves it.
- **Actions and security:** deleting, linking and exporting the players' data are administrator actions, which automations still run; exports go to the media folder by default, only to folders where Home Assistant allows writing and at most 20 an hour; a board found at a new address moves only after you confirm a repair; the highlight gallery shows small thumbnails; invalid values of an action get a message in your language.
- **Quieter entities:** *Last event* and *CPU usage*, which change all the time, start disabled on boards set up from now on.
- **Blueprints:** the visit score and the light show leave the bot out unless you turn on *Also for the bot*, and the callers and the light show name it "Bot" like the scoreboard; the highlight photo hands the saved photo to your notification as `photo_url`; the light show keeps up to nine moments waiting behind an effect, reacts to the takeout only when you ask, and never pauses the detection in the middle of a visit; player names never become templates.
- Brand icons and logos in the sizes of the Home Assistant brand specification.

### Documentation

- A new structure with illustrated guides for [games and rules](docs/games.md), the [scoreboard at the board](docs/scoreboard.md), [statistics and players](docs/statistics.md) and [online matches](docs/online-matches.md), a [glossary](docs/glossary.md) in English and German and an accessibility section in the card guide.
- A new README for HACS, with an animation of the live card and the scoreboard and a feature overview; many new screenshots and animations, and a demo with four weeks of long-term statistics.

### Quality

- 100 % line and branch coverage of the integration and DOM tests of every card element; an end-to-end test against Home Assistant 2026.8.0, the oldest supported release.
- CodeQL also checks the card JavaScript; releases are published only with their signed package attached.
- Community files: security policy with response times, support routes, Discussions, governance and contributor tooling.

## 1.5.0

- Shanghai, Halve-It and Killer for one to four players; X01 from 101 to 1001 with double in and a bull-off.
- Player profiles with statistics and personal bests per name, a match history, head-to-head records and a players card.
- A doubles analysis with the hit rate of every double, a doubles card and personal checkout routes.
- A caller in the scoreboard that announces the game through the browser, off by default.

## 1.4.0

- Cricket for one to four players with marks, closed numbers, points and marks per round, and a chalkboard in the live card.
- A scoreboard card and a full-screen scoreboard view for a screen at the board.
- Personal bests with an event when one is beaten, a training streak in days and a daily goal.
- `autodarts.start_game` starts X01, Cricket or a training game with players, names and format in one action.
- Detection quality: the share of corrected darts, with a repair that recalibrates the board when it rises.

## 1.3.0

- X01 matches for two to four players at one board, with legs, sets, player names and a scoreboard in the live card.
- Training games: Around the Clock, doubles training, checkout training and Bob's 27.
- Practice statistics: first-9 average, checkout rate, doubles rate and legs per day.
- Two blueprints: a practice caller and a highlight photo after a 180 or a checkout.

## 1.2.0

- X01 practice games (301, 501, 701): remaining score, busts, double out, checkout routes and the last 10 legs, with the `bust` and `leg_won` events.
- A practice panel in the live card with the checkout route and the next bed to aim at.
- Live camera streams from Board Manager 2 instead of snapshots.

## 1.1.0

- Training sessions that start with the first dart or on purpose, end after a pause and keep the last 20 sessions.
- The `session_started` and `session_ended` events, and a blueprint that ties light, detection and calibration to a session.
- The last visits in the live card, and the session state and past sessions in the training card.
- Board PC details from Board Manager 2: operating system, processor and detection software.

## 1.0.2

- The repository is now called `Dennis-Otto/ha-autodarts`; GitHub redirects the old address.

## 1.0.1

- Setup no longer offers the cloud link while Autodarts has not issued its client ID; old cloud entries keep working locally.
- Card colors accept valid CSS colors only.

## 1.0.0

- Local realtime connection to Board Manager 1 and 2, with automatic discovery; no Autodarts cloud account needed.
- Controls, board settings, camera health and Board Manager updates.
- Training analytics with hits per bed, a visit history and the `visit_completed` event.
- Three dashboard cards, an automatic dashboard and six blueprints.
- Documentation in English and German.

## 0.4.2 to 0.4.5

Pre-releases that led to 1.0.0.
