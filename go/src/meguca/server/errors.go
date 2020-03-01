// API error interface and centralized collection of all errors return
// by server.
package server

import (
	"errors"
	"fmt"

	"meguca/ipc"
)

// Error returned by API. Serialized to common shape understanable by
// frontend. Can also keep error from internal subsystems which is never
// shown to the user by might be e.g. logged for debugging purposes.
// TODO(Kagami): easyjson.
type ApiError struct {
	code      int
	err       error
	hiddenErr error
}

func aerrorNew(code int, text string) ApiError {
	err := errors.New(text)
	return ApiError{code: code, err: err}
}

func aerrorFrom(code int, err error) ApiError {
	return ApiError{code: code, err: err}
}

func (ae ApiError) Hide(err error) ApiError {
	ae.hiddenErr = err
	return ae
}

func (ae ApiError) Code() int {
	// Fix if set incorrectly, to prevent panic in net/http.
	if ae.code < 100 {
		return 500
	}
	return ae.code
}

func (ae ApiError) Error() string {
	err := ae.err
	if ae.hiddenErr != nil {
		err = ae.hiddenErr
	}
	return fmt.Sprintf("%v", err)
}

func (ae ApiError) MarshalJSON() ([]byte, error) {
	err := ae.err
	// Do not leak sensitive data to users.
	if ae.Code() >= 500 {
		err = aerrInternal
	}
	s := fmt.Sprintf(`{"error":"%v"}`, err)
	return []byte(s), nil
}

// Predefined API errors.
var (
	aerrNoURL            = aerrorNew(400, "No url")
	aerrNotSupportedURL  = aerrorNew(400, "Url not supported")
	aerrInternal         = aerrorNew(500, "Internal server error")
	aerrPowerUserOnly    = aerrorNew(403, "Only for power users")
	aerrBoardOwnersOnly  = aerrorNew(403, "Only for board owners")
	aerrParseForm        = aerrorNew(400, "Error parsing form")
	aerrParseJSON        = aerrorNew(400, "Error parsing JSON")
	aerrNoFile           = aerrorNew(400, "No file provided")
	aerrBadUuid          = aerrorNew(400, "Malformed UUID")
	aerrDupPreview       = aerrorNew(400, "Duplicated preview")
	aerrBadPreview       = aerrorNew(400, "Only JPEG previews allowed")
	aerrBadPreviewDims   = aerrorNew(400, "Only square previews allowed")
	aerrNoIdol           = aerrorNew(404, "No such idol")
	aerrTooLarge         = aerrorNew(400, "File too large")
	aerrTooManyFiles     = aerrorNew(400, "Too many files")
	atleastOneFile       = aerrorNew(400, "Atleast one file is required")
	invalidName          = aerrorNew(400, "Invalid name")
	aerrUploadRead       = aerrorNew(400, "Error reading upload")
	aerrCorrupted        = aerrorNew(400, "Corrupted file")
	cantRenameSmile      = aerrorNew(400, "Can't rename smile")
	cantDeleteSmile      = aerrorNew(400, "Can't delete smile")
	aerrNameTaken        = aerrorNew(400, "Name already taken")
	aerrNotEnoughCntrast = aerrorNew(400, "Color must be distinguishable in both themes. Increase contrast ratio.")
	aerrTooManyIgnores   = aerrorNew(400, "Too many users ignored")
	aerrDupIgnores       = aerrorNew(400, "Duplicated ignores")
	aerrInvalidUserID    = aerrorNew(400, "Invalid user ID")
	aerrInvalidState     = aerrorNew(400, "Wrong board state")
	aerrUnsyncState      = aerrorNew(400, "Unsync board state")
	aerrTitleTooLong     = aerrorNew(400, "Board title too long")
	aerrInvalidReason    = aerrorNew(400, "Invalid ban reason")
	aerrInvalidPosition  = aerrorNew(400, "Invalid position")
	aerrTooManyStaff     = aerrorNew(400, "Too many staff")
	aerrTooManyBans      = aerrorNew(400, "Too many bans")
	aerrUnsupported      = aerrorFrom(400, ipc.ErrThumbUnsupported)
	aerrNoTracks         = aerrorFrom(400, ipc.ErrThumbTracks)
)

// Legacy errors.
// TODO(Kagami): Migrate to ApiError interface.
var (
	errInvalidBoard     = errors.New("Invalid board")
	errReadOnly         = errors.New("Read only board")
	errOnlyRegistered   = errors.New("Only registered users are allowed")
	errOnlyWhitelist    = errors.New("This board is whitelist only")
	errBanned           = errors.New("You are banned")
	errBannedBoard      = errors.New("You are banned on this board")
	errNoImage          = errors.New("Post has no image")
	errNotConnected     = errors.New("You are not connected to the board")
	errNoNews           = errors.New("Can't get news")
	errPageOverflow     = errors.New("Page not found")
	errInvalidBoardName = errors.New("Invalid board name")
	errBoardNameTaken   = errors.New("Board name taken")
	errAlreadyReacted   = errors.New("You have already reacted")
	errAccessDenied     = errors.New("Access denied")
	errNoDuration       = errors.New("No ban duration provided")
	errNoBoardOwner     = errors.New("No board owners set")
	errInvalidCaptcha   = errors.New("Invalid captcha")
	errInvalidPassword  = errors.New("Invalid password")
	errUserIDTaken      = errors.New("Login ID already taken")
)
