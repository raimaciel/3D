# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repository is empty apart from `README.md`, whose entire content is the title `# Projeto 3D`.

There is no source code, no dependency manifest, no build system, no tests and no CI configuration. Nothing here describes code that exists yet — the sections below record that absence deliberately, so that a future session does not mistake a plausible guess for an established convention.

## No stack has been chosen

The repository name is the only hint about intent, and it is not enough to act on. "3D" is equally consistent with Three.js, React Three Fiber, Babylon.js, a game engine project, Blender/Python scripting, or C++/OpenGL. Do not infer one and start scaffolding: the first substantive commit fixes the project's direction, and a wrong guess is expensive to undo. Ask which stack is intended before creating project files.

## Keeping this file accurate

The commands and architecture sections that belong in this file cannot be written yet, because the commands and architecture do not exist. Leave them absent rather than filling them with commands that merely look right for the chosen framework.

Whoever adds the first working stack should replace this section with the real, verified versions:

- **Build / run / lint / test** — the actual invocations for this project, including how to run a single test.
- **Architecture** — the big-picture structure that requires reading several files to grasp, not a directory listing.

Verify each command by running it before writing it down here.

## Conventions observed so far

- `README.md` is written in Portuguese ("Projeto 3D"). Match the existing language of the repository in documentation and user-facing text unless asked otherwise.

## Git

- Default branch: `main`, which holds the repository's single commit.
- Claude Code sessions develop on their own `claude/*` branches rather than committing to `main` directly.
