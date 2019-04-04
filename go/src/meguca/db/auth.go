package db

import (
	"database/sql"
	"errors"
	"math"
	"regexp"
	"strconv"
	"time"

	"meguca/auth"
	"meguca/common"
)

var (
	ErrUserNameTaken = errors.New("user name already taken")
	ErrContrast      = errors.New("Color must be distinguishable in both themes. Increase contrast.")
)

// Get user's session by token.
func GetSession(board, token string) (ss *auth.Session, err error) {
	var userID string
	var userName string
	var settingsData []byte
	q := prepared["get_account_by_token"].QueryRow(token)
	err = q.Scan(&userID, &userName, &settingsData)
	if err != nil {
		if err == sql.ErrNoRows {
			err = common.ErrInvalidCreds
		}
		return
	}

	pos, err := getPositions(board, userID)
	if err != nil {
		return
	}

	var settings auth.AccountSettings
	if err = settings.UnmarshalJSON(settingsData); err != nil {
		return
	}
	settings.Name = userName
	ss = &auth.Session{
		UserID:    userID,
		Positions: pos,
		Settings:  settings,
	}
	return
}

func toInt(s string) (x1 int64, x2 int64, x3 int64, err error) {

	x1, err = strconv.ParseInt(s[:2], 16, 64)
	x2, err = strconv.ParseInt(s[2:4], 16, 64)
	x3, err = strconv.ParseInt(s[4:], 16, 64)
	return x1, x2, x3, err
}

func getLinearRGB(n float64) (num float64) {
	if n > 0.03928 {
		return math.Pow(((n + 0.055) / 1.055), 2.4)
	}
	return n / 12.92
}

func getRelativeLuma(color string) (l float64, err error) {
	var r, g, b int64
	var rC, gC, bC float64
	r, g, b, err = toInt(color)
	if err != nil {
		return 0, err
	}

	rC = getLinearRGB(float64(r) / 255)
	gC = getLinearRGB(float64(g) / 255)
	bC = getLinearRGB(float64(b) / 255)

	l = 0.2126*rC + 0.7152*gC + 0.0722*bC
	return l, err
}

func checkContrast(l1 float64, l2 float64) bool {
	var contrast float64
	if l1 >= l2 {
		contrast = (l1 + 0.05) / (l2 + 0.05)
	} else {
		contrast = (l2 + 0.05) / (l1 + 0.05)
	}

	if contrast < 1.45 {
		return false
	}
	return true
}

func SetAccountSettings(userID string, as auth.AccountSettings) (err error) {
	// NOTE(Kagami): We store name as a field to ensure uniqueness by DB.
	// So it will be duplicated in JSON settings structure. We don't mind
	// of this for simplicity and it won't cause any inconsistency.
	var re = regexp.MustCompile(`[^0-9a-fA-F]`)
	s := re.ReplaceAllString(as.Color, ``)
	as.Color = s
	var l1, l2, l3 float64
	l1, err = getRelativeLuma(as.Color)
	if err != nil {
		return
	}
	l2, err = getRelativeLuma("eef0f2")
	l3, err = getRelativeLuma("37383b")
	contrast := checkContrast(l1, l2)
	if contrast != true {
		err = ErrContrast
		return err
	}

	contrast = checkContrast(l1, l3)
	if contrast != true {
		err = ErrContrast
		return err
	}

	settingsData, err := as.MarshalJSON()
	if err != nil {
		return
	}

	err = execPrepared("update_account_settings", userID, as.Name, settingsData)
	if IsConflictError(err) {
		err = ErrUserNameTaken
	}
	return
}

// RegisterAccount writes the ID and password hash of a new user account to the
// database
func RegisterAccount(ID string, hash []byte) error {
	err := execPrepared("register_account", ID, hash)
	if IsConflictError(err) {
		return ErrUserNameTaken
	}
	return err
}

// GetPassword retrieves the login password hash of the registered user account
func GetPassword(id string) (hash []byte, err error) {
	err = prepared["get_password"].QueryRow(id).Scan(&hash)
	return
}

// Get highest positions of specified user.
func getPositions(board, userID string) (pos auth.Positions, err error) {
	if userID == "admin" {
		pos.CurBoard = auth.Admin
		pos.AnyBoard = auth.Admin
		return
	}

	rs, err := prepared["get_positions"].Query(userID)
	if err != nil {
		return
	}
	defer rs.Close()

	var posBoard string
	var posLevel string
	for rs.Next() {
		err = rs.Scan(&posBoard, &posLevel)
		if err != nil {
			return
		}
		level := auth.NotStaff
		switch posLevel {
		case "owners":
			level = auth.BoardOwner
		case "moderators":
			level = auth.Moderator
		case "janitors":
			level = auth.Janitor
		}
		if level > pos.AnyBoard {
			pos.AnyBoard = level
		}
		// NOTE(Kagami): It's fine to pass board = "" to getPositions.
		// posBoard can't be empty so resulting CurBoard will be "notStaff"
		// which is perfectly ok.
		if posBoard == board && level > pos.CurBoard {
			pos.CurBoard = level
		}
	}
	err = rs.Err()
	return
}

// WriteLoginSession writes a new user login session to the DB
func WriteLoginSession(account, token string) error {
	expiryTime := time.Duration(common.SessionExpiry) * time.Hour * 24
	return execPrepared(
		"write_login_session",
		account,
		token,
		time.Now().Add(expiryTime),
	)
}

// LogOut logs the account out of one specific session
func LogOut(account, token string) error {
	return execPrepared("log_out", account, token)
}

// LogOutAll logs an account out of all user sessions
func LogOutAll(account string) error {
	return execPrepared("log_out_all", account)
}

// ChangePassword changes an existing user's login password
func ChangePassword(account string, hash []byte) error {
	return execPrepared("change_password", account, hash)
}
