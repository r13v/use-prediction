# Changelog

## 1.0.0 (2026-10-22)


### ⚠ BREAKING CHANGES

* get(value, controller) is now get({ text, before, after, signal }). The color and style options are replaced by className. ref is a callback ref.

### Features

* add a loading indicator and switch to Biome, Knip and Lefthook ([32eae17](https://github.com/r13v/use-prediction/commit/32eae17c9f0b93968371a8e48af02f44dc0058d0))
* loading indicator; Biome, Knip and Lefthook ([25d0ec2](https://github.com/r13v/use-prediction/commit/25d0ec2535bac007da8eb602e3a1084760aaa90a))
* rework usePrediction for existing inputs and forms ([524e5a8](https://github.com/r13v/use-prediction/commit/524e5a82c1ee3a9881a59bda138973c6f23ccc36))
* show prediction ([e6a86db](https://github.com/r13v/use-prediction/commit/e6a86dba6326df61c144a06d307a9f0859259b81))
* trap focus ([7bf51e7](https://github.com/r13v/use-prediction/commit/7bf51e716ca10f7b502608e746e150bdb03b9675))
* update params ([194c130](https://github.com/r13v/use-prediction/commit/194c130a20bb269babfc41e5c6ad828cf0accbbe))


### Bug Fixes

* add react 18 to peer dependencies ([bacab1c](https://github.com/r13v/use-prediction/commit/bacab1c535588a82e969f560e44c9edf61ff417c))
