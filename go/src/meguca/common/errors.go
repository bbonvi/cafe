// TODO(Kagami): Somehow merge with server/errors.go
package common

import (
	"errors"
	"strconv"
)

// Commonly used errors
var (
	ErrNameTooLong    = ErrTooLong("Name")
	ErrNoSubject      = errors.New("No subject")
	ErrSubjectTooLong = ErrTooLong("Subject")
	ErrBodyTooLong    = ErrTooLong("Post body")
	ErrInvalidCreds   = errors.New("Invalid login credentials")
	ErrContainsNull   = errors.New("Null byte in non-concatenated message")
)

// ErrTooLong is passed, when a field exceeds the maximum string length for
// that specific field
type ErrTooLong string

func (e ErrTooLong) Error() string {
	return string(e) + " too long"
}

// ErrInvalidPostID signifies that the post ID passed by the client is invalid
// in some way. In what way exactly should be evident from the API endpoint.
type ErrInvalidPostID uint64

func (e ErrInvalidPostID) Error() string {
	return "invalid post ID: " + strconv.FormatUint(uint64(e), 10)
}
