#!/usr/bin/env node

import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const expectedPackageName = "use-prediction"
const expectedRepositoryUrl = "https://github.com/r13v/use-prediction"
const expectedGitHubRepository = "r13v/use-prediction"
const REGISTRY_TIMEOUT_MS = 15_000
const MAX_NPM_OUTPUT_BYTES = 1024 * 1024
const STABLE_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u
const AUTHENTICATION_ERROR =
	/\b(?:E401|E403|ENEEDAUTH)\b|authenticat|unauthorized|forbidden/i
const OUTAGE_ERROR =
	/\b(?:E5\d{2}|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN)\b|service unavailable|socket hang up/i
const NOT_FOUND_ERROR = /\bE404\b|404|not found|not in this registry/i
const TIMEOUT_ERROR = /timed out|timeout/i

export class ReleaseGuardError extends Error {
	constructor(code, message) {
		super(message)
		this.name = "ReleaseGuardError"
		this.code = code
	}
}

export async function verifyRelease({
	packageJson,
	packageLock,
	eventTag,
	githubRepository,
	lookupVersion = defaultRegistryLookup,
}) {
	const packageName = readString(packageJson.name, "package.json name")

	if (packageName !== expectedPackageName) {
		throwReleaseError(
			"package_name_mismatch",
			`package name must be ${expectedPackageName}, got ${packageName}`,
		)
	}

	const version = readString(packageJson.version, "package.json version")
	assertStableVersion(version)
	assertLockfileVersion(packageLock, version)
	assertReleaseTag(eventTag, version)
	assertRepository(packageJson.repository)
	assertGitHubRepository(githubRepository)

	const registryResult = await lookupVersion({ packageName, version })

	if (registryResult.status === "published") {
		throwReleaseError(
			"version_already_published",
			`${packageName}@${version} is already published on npm`,
		)
	}

	if (registryResult.status !== "available") {
		throwReleaseError(
			"registry_lookup_failed",
			`npm registry lookup did not prove ${packageName}@${version} is available: ${registryResult.reason}`,
		)
	}

	return {
		packageName,
		repositoryUrl: expectedRepositoryUrl,
		tag: `v${version}`,
		version,
	}
}

export async function defaultRegistryLookup({
	packageName,
	version,
	timeoutMs = REGISTRY_TIMEOUT_MS,
}) {
	try {
		const { stdout, stderr } = await execFileAsync(
			"npm",
			["view", `${packageName}@${version}`, "version", "--json"],
			{
				maxBuffer: MAX_NPM_OUTPUT_BYTES,
				timeout: timeoutMs,
				windowsHide: true,
			},
		)

		return classifyNpmViewResult({
			expectedVersion: version,
			stdout,
			stderr,
		})
	} catch (error) {
		return classifyNpmViewResult({
			error,
			expectedVersion: version,
			stdout: error?.stdout,
			stderr: error?.stderr,
		})
	}
}

export function classifyNpmViewResult({
	error,
	stdout = "",
	stderr = "",
	expectedVersion,
}) {
	const detail = collectLookupDetail(error, stdout, stderr)

	if (isTimeoutError(error, detail)) {
		return {
			status: "error",
			reason: "timeout",
			detail,
		}
	}

	if (error !== undefined) {
		return classifyNpmViewError(detail, expectedVersion)
	}

	try {
		const parsed = JSON.parse(stdout.trim())

		if (parsed === expectedVersion) {
			return {
				status: "published",
				version: parsed,
			}
		}

		if (typeof parsed === "string") {
			return {
				status: "error",
				reason: "unexpected_version",
				detail: parsed,
			}
		}

		return {
			status: "error",
			reason: "malformed_response",
			detail: stdout,
		}
	} catch {
		return {
			status: "error",
			reason: "malformed_response",
			detail: stdout,
		}
	}
}

/** A failed `npm view`: an unpublished version is the only good outcome. */
function classifyNpmViewError(detail, expectedVersion) {
	if (isVersionNotFound(detail, expectedVersion)) {
		return {
			status: "available",
			reason: "version_not_found",
		}
	}

	if (AUTHENTICATION_ERROR.test(detail)) {
		return {
			status: "error",
			reason: "authentication",
			detail,
		}
	}

	if (OUTAGE_ERROR.test(detail)) {
		return {
			status: "error",
			reason: "registry_outage",
			detail,
		}
	}

	if (NOT_FOUND_ERROR.test(detail)) {
		return {
			status: "error",
			reason: "package_not_found",
			detail,
		}
	}

	return {
		status: "error",
		reason: "registry_error",
		detail,
	}
}

export function normalizeRepositoryUrl(repository) {
	const raw = typeof repository === "string" ? repository : repository?.url

	if (typeof raw !== "string") {
		return undefined
	}

	const normalized = raw
		.trim()
		.replace(/^git\+/, "")
		.replace(/^git@github\.com:/i, "https://github.com/")
		.replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/")
		.replace(/^git:\/\/github\.com\//i, "https://github.com/")
		.replace(/\.git(?:[#?].*)?$/i, "")
		.replace(/\/$/u, "")

	return normalized.toLowerCase()
}

async function main() {
	const rootDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)))
	const packageJson = await readJsonFile(
		new URL("../package.json", import.meta.url),
	)
	const packageLock = await readJsonFile(
		new URL("../package-lock.json", import.meta.url),
	)
	const eventTag =
		process.env.USE_PREDICTION_RELEASE_TAG ?? process.env.GITHUB_REF_NAME
	const result = await verifyRelease({
		eventTag,
		githubRepository: process.env.GITHUB_REPOSITORY,
		packageJson,
		packageLock,
	})

	console.log(
		`Release guard passed for ${result.packageName}@${result.version} in ${rootDirectory}`,
	)
}

function assertStableVersion(version) {
	if (version === "0.0.0") {
		throwReleaseError("zero_version", "0.0.0 cannot be published")
	}

	if (!STABLE_VERSION.test(version)) {
		throwReleaseError(
			"unstable_version",
			`release version must be a stable x.y.z version, got ${version}`,
		)
	}
}

function assertLockfileVersion(packageLock, version) {
	const lockVersion = readString(
		packageLock.version,
		"package-lock.json version",
	)
	const rootPackage = packageLock.packages?.[""]
	const rootVersion = readString(
		rootPackage?.version,
		"package-lock.json root package version",
	)

	if (lockVersion !== version || rootVersion !== version) {
		throwReleaseError(
			"lockfile_version_mismatch",
			`package-lock.json must match package.json version ${version}`,
		)
	}
}

function assertReleaseTag(eventTag, version) {
	const expectedTag = `v${version}`

	if (eventTag !== expectedTag) {
		throwReleaseError(
			"tag_mismatch",
			`release tag must be ${expectedTag}, got ${eventTag ?? "<missing>"}`,
		)
	}
}

function assertRepository(repository) {
	const repositoryUrl = normalizeRepositoryUrl(repository)

	if (repositoryUrl !== expectedRepositoryUrl) {
		throwReleaseError(
			"repository_mismatch",
			`repository must normalize to ${expectedRepositoryUrl}, got ${repositoryUrl ?? "<missing>"}`,
		)
	}
}

function assertGitHubRepository(githubRepository) {
	const otherRepository =
		githubRepository !== undefined &&
		githubRepository.toLowerCase() !== expectedGitHubRepository

	if (otherRepository) {
		throwReleaseError(
			"github_repository_mismatch",
			`GitHub repository must be ${expectedGitHubRepository}, got ${githubRepository}`,
		)
	}
}

function readString(value, label) {
	if (typeof value !== "string" || value.length === 0) {
		throwReleaseError("invalid_metadata", `${label} must be a non-empty string`)
	}

	return value
}

function collectLookupDetail(error, stdout, stderr) {
	const message = typeof error?.message === "string" ? error.message : ""

	return [stdout, stderr, message].filter(Boolean).join("\n").trim()
}

function isVersionNotFound(detail, expectedVersion) {
	return (
		detail.includes(`No match found for version ${expectedVersion}`) ||
		detail.includes(`No matching version found: ${expectedVersion}`)
	)
}

function isTimeoutError(error, detail) {
	return (
		error?.killed === true ||
		error?.signal === "SIGTERM" ||
		error?.code === "ETIMEDOUT" ||
		TIMEOUT_ERROR.test(detail)
	)
}

function throwReleaseError(code, message) {
	throw new ReleaseGuardError(code, message)
}

async function readJsonFile(url) {
	const text = await readFile(url, "utf8")

	return JSON.parse(text)
}

function isMainModule() {
	return (
		process.argv[1] !== undefined &&
		import.meta.url === pathToFileURL(process.argv[1]).href
	)
}

if (isMainModule()) {
	try {
		await main()
	} catch (error) {
		if (error instanceof ReleaseGuardError) {
			console.error(`${error.code}: ${error.message}`)
		} else if (error instanceof Error) {
			console.error(error.stack ?? error.message)
		} else {
			console.error(error)
		}

		process.exitCode = 1
	}
}
